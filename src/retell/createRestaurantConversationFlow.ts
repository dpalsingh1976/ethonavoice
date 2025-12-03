import Retell from 'retell-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Retell({
  apiKey: process.env.RETELL_API_KEY!,
});

async function createRestaurantFlow() {
  if (!process.env.RETELL_API_KEY) {
    console.error('Error: RETELL_API_KEY is not set in environment variables');
    process.exit(1);
  }

  console.log('Creating restaurant conversation flow...');

  // Define nodes separately - SDK types may not be up to date with function node
  const nodes: any[] = [
    // 1) Welcome
    {
      id: 'welcome',
      type: 'conversation',
      instruction: {
        type: 'static_text',
        text: 'Thank you for calling {{restaurant_name}}! How can I help you today?',
      },
      edges: [
        {
          id: 'edge_welcome_order',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller wants to place a pickup order',
          },
          destination_node_id: 'start_order',
        },
        {
          id: 'edge_welcome_question',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller mainly has a question (hours, location, menu, etc.)',
          },
          destination_node_id: 'faq',
        },
      ],
    },

    // 2) Start Order (collect items)
    {
      id: 'start_order',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `
The caller is placing a pickup order.
Ask what they would like to order and add items one by one.

Rules:
- Ask 1 question at a time.
- Confirm item name, quantity, and any options (spice level, cheese, etc.).
- If item not found, offer 2–3 similar menu items instead.
- When the caller says they're done (e.g. "that's it"), stop adding items
  and move to the order_summary node.
`,
      },
      edges: [
        {
          id: 'edge_start_order_done',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller indicates they are done adding items',
          },
          destination_node_id: 'order_summary',
        },
      ],
    },

    // 3) Order Summary & Confirmation
    {
      id: 'order_summary',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `
Summarize the full order:

- List all items with quantity and key options.
- Give pickup time (use {{default_pickup_eta}} if they don't specify).
- Ask for name and callback phone if missing.
Then ask explicitly: "Does everything look correct and should I place this order?"

If the caller wants changes, go back to start_order.
If they confirm, go to save_order.
`,
      },
      edges: [
        {
          id: 'edge_summary_confirm',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller confirms the order is correct and wants to place it',
          },
          destination_node_id: 'save_order',
        },
        {
          id: 'edge_summary_change',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller wants to change items in the order',
          },
          destination_node_id: 'start_order',
        },
      ],
    },

    // 4) Save Order (function node – webhook)
    {
      id: 'save_order',
      type: 'function',
      func_id: 'save_pickup_order',
      edges: [
        {
          id: 'edge_save_success',
          transition_condition: {
            type: 'prompt',
            prompt: 'Order saved successfully',
          },
          destination_node_id: 'confirm_pickup',
        },
        {
          id: 'edge_save_fail',
          transition_condition: {
            type: 'prompt',
            prompt: 'There was an error saving the order',
          },
          destination_node_id: 'error_node',
        },
      ],
    },

    // 5) Confirm Pickup
    {
      id: 'confirm_pickup',
      type: 'conversation',
      instruction: {
        type: 'static_text',
        text:
          'Your pickup order is confirmed! We will have it ready in about {{default_pickup_eta}}. ' +
          'Thank you for calling {{restaurant_name}}.',
      },
      edges: [
        {
          id: 'edge_confirm_end',
          transition_condition: {
            type: 'prompt',
            prompt: 'Always transition after confirmation',
          },
          destination_node_id: 'end_call',
        },
      ],
    },

    // 6) FAQ Node
    {
      id: 'faq',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `
Answer questions about restaurant hours, address, parking, and menu.
If the caller later says they want to order, send them to start_order.
If their question is resolved and they don't want to order, end the call politely.
`,
      },
      edges: [
        {
          id: 'edge_faq_to_order',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller now wants to place an order',
          },
          destination_node_id: 'start_order',
        },
        {
          id: 'edge_faq_to_exit',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller is done and does not want to order',
          },
          destination_node_id: 'exit_strategy',
        },
      ],
    },

    // 7) Exit Strategy
    {
      id: 'exit_strategy',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `
The caller does not want to place an order.

Politely close the call:
- Example: "No problem at all, thanks for calling {{restaurant_name}}.
  If you ever want to order later, just give us a call. Have a great day!"

Then move to end_call.
`,
      },
      edges: [
        {
          id: 'edge_exit_end',
          transition_condition: {
            type: 'prompt',
            prompt: 'Always transition after exit message',
          },
          destination_node_id: 'end_call',
        },
      ],
    },

    // 8) Error Node
    {
      id: 'error_node',
      type: 'conversation',
      instruction: {
        type: 'static_text',
        text:
          'Sorry, something went wrong while saving your order. ' +
          'Would you like me to try again?',
      },
      edges: [
        {
          id: 'edge_error_retry',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller wants to try again',
          },
          destination_node_id: 'save_order',
        },
        {
          id: 'edge_error_exit',
          transition_condition: {
            type: 'prompt',
            prompt: 'Caller does not want to continue',
          },
          destination_node_id: 'exit_strategy',
        },
      ],
    },

    // 9) End Call
    {
      id: 'end_call',
      type: 'end',
    },
  ];

  const response = await client.conversationFlow.create({
    model_choice: { type: 'cascading', model: 'gpt-4o' },
    start_speaker: 'agent',
    global_prompt: `
You are a friendly phone assistant for an Indian restaurant.
You answer questions, help callers place pickup orders, confirm details,
and end calls politely. Keep answers short and clear.`,
    default_dynamic_variables: {
      restaurant_name: 'Honest Clifton',
      default_pickup_eta: '20–25 minutes',
    },
    nodes,
    start_node_id: 'welcome',
    tools: [
      {
        type: 'custom',
        name: 'save_pickup_order',
        description: 'Save pickup order to backend. Pass customerName, customerPhone, items array with name/quantity/price/spiceLevel, subtotal, tax, and total.',
        tool_id: 'save_pickup_order',
        url: 'https://rsvrhwslkonyrqfvqzzv.supabase.co/functions/v1/retell-create-order',
        method: 'POST',
      },
    ],
  });

  console.log('✅ Conversation Flow created successfully!');
  console.log('Conversation Flow ID:', response.conversation_flow_id);
  console.log('\nYou can now use this flow ID to create an agent in Retell dashboard.');
}

createRestaurantFlow().catch((error) => {
  console.error('Failed to create conversation flow:', error);
  process.exit(1);
});
