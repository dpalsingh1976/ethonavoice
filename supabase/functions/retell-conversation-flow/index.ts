import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { indianMenuDictionary, buildASRHints, enrichMenuItemsWithVariants } from "../_shared/menuDictionary.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  is_available: boolean;
  is_vegetarian: boolean;
  spice_level_options?: string[];
  category_id?: string;
}

interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface RestaurantHours {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

function formatMenu(categories: MenuCategory[], items: MenuItem[]): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  if (categories.length === 0 && items.length === 0) {
    return 'Menu not available. Ask the caller what they would like and note it down.';
  }

  let menuText = 'MENU:\n';
  
  // Group items by category
  const itemsByCategory: Record<string, MenuItem[]> = {};
  const uncategorizedItems: MenuItem[] = [];
  
  items.forEach(item => {
    if (!item.is_available) return;
    if (item.category_id) {
      if (!itemsByCategory[item.category_id]) {
        itemsByCategory[item.category_id] = [];
      }
      itemsByCategory[item.category_id].push(item);
    } else {
      uncategorizedItems.push(item);
    }
  });

  // Sort categories and output
  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  
  sortedCategories.forEach(category => {
    const categoryItems = itemsByCategory[category.id] || [];
    if (categoryItems.length > 0) {
      menuText += `\n${category.name.toUpperCase()}:\n`;
      categoryItems.forEach(item => {
        const veg = item.is_vegetarian ? ' (V)' : '';
        const desc = item.description ? ` - ${item.description}` : '';
        menuText += `- ${item.name}${veg}: $${item.price}${desc}\n`;
      });
    }
  });

  if (uncategorizedItems.length > 0) {
    menuText += '\nOTHER ITEMS:\n';
    uncategorizedItems.forEach(item => {
      const veg = item.is_vegetarian ? ' (V)' : '';
      const desc = item.description ? ` - ${item.description}` : '';
      menuText += `- ${item.name}${veg}: $${item.price}${desc}\n`;
    });
  }

  return menuText;
}

function formatHours(hours: RestaurantHours[]): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  if (hours.length === 0) {
    return 'Hours not specified. Please ask the caller to call back during normal business hours.';
  }

  let hoursText = 'OPERATING HOURS:\n';
  
  const sortedHours = [...hours].sort((a, b) => a.day_of_week - b.day_of_week);
  
  sortedHours.forEach(h => {
    const day = dayNames[h.day_of_week];
    if (h.is_closed) {
      hoursText += `${day}: Closed\n`;
    } else {
      hoursText += `${day}: ${h.open_time} - ${h.close_time}\n`;
    }
  });

  return hoursText;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
    if (!RETELL_API_KEY) {
      throw new Error('RETELL_API_KEY is not configured');
    }

    const { restaurantId } = await req.json();
    if (!restaurantId) {
      throw new Error('restaurantId is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch restaurant data including knowledge base ID
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*, retell_knowledge_base_id')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Fetch voice settings, hours, menu
    const [voiceResult, hoursResult, categoriesResult, itemsResult] = await Promise.all([
      supabase.from('restaurant_voice_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
      supabase.from('restaurant_hours').select('*').eq('restaurant_id', restaurantId),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('is_available', true),
    ]);

    const voiceSettings = voiceResult.data || {};
    const hours = hoursResult.data || [];
    const categories = categoriesResult.data || [];
    const menuItems = itemsResult.data || [];

    const menuText = formatMenu(categories, menuItems);
    const hoursText = formatHours(hours);

    // Build ASR hints from menu items enriched with phonetic variants
    // Also include the full Indian menu dictionary as fallback for better recognition
    const enrichedMenuItems = enrichMenuItemsWithVariants(
      menuItems.map((item: MenuItem) => ({ id: item.id, name: item.name, category_id: item.category_id })),
      indianMenuDictionary
    );
    
    // Combine enriched DB items with full dictionary for comprehensive ASR hints
    const allMenuItemsForHints = enrichedMenuItems.length > 0 
      ? enrichedMenuItems 
      : indianMenuDictionary; // Use full dictionary if no DB items
    
    // Always include the static dictionary items in ASR hints for better recognition
    const asrHints = buildASRHints([...enrichedMenuItems, ...indianMenuDictionary]);
    console.log(`Built ${asrHints.length} ASR hints for restaurant: ${restaurant.name} (${enrichedMenuItems.length} from DB, ${indianMenuDictionary.length} from dictionary)`);

    // Build the webhook URL for order creation
    const orderWebhookUrl = `${supabaseUrl}/functions/v1/retell-create-order`;

    // Build Conversation Flow with enhanced pronunciation guidance
    const conversationFlowPayload = {
      model_choice: { type: 'cascading', model: 'gpt-4.1' },
      start_speaker: 'agent',
      global_prompt: `
You are a friendly phone assistant for ${restaurant.name}, an Indian restaurant.
You answer questions, help callers place pickup orders, confirm details, and end calls politely.
Keep answers short and clear. Be warm and professional.

IMPORTANT - PRONUNCIATION HANDLING:
You are taking food orders for an Indian restaurant. Customers may mispronounce menu items in various ways:
- "pow bhaji", "pao bhaji", "pav bhajee" all mean "Pav Bhaji"
- "wada pav", "vada pow", "wadapav" all mean "Vada Pav"
- "masala dosai", "masaala dosa" all mean "Masala Dosa"
The text you receive may already be normalized, but if you see something close to a known menu item, assume it is that item and confirm gently.
Always use the correct canonical menu item name when confirming orders.

${voiceSettings.notes_for_agent ? `SPECIAL INSTRUCTIONS:\n${voiceSettings.notes_for_agent}\n` : ''}

RESTAURANT INFO:
- Name: ${restaurant.name}
- Address: ${restaurant.address}
- Phone: ${restaurant.phone}

${hoursText}

${menuText}
`,
      default_dynamic_variables: {
        restaurant_name: restaurant.name,
        default_pickup_eta: '20-25 minutes',
        restaurant_address: restaurant.address,
        restaurant_phone: restaurant.phone,
      },
      nodes: [
        // 1) Welcome
        {
          id: 'welcome',
          type: 'conversation',
          instruction: {
            type: 'static_text',
            text: voiceSettings.greeting_en || `Thank you for calling {{restaurant_name}}! How can I help you today?`,
          },
          edges: [
            {
              id: 'edge_welcome_order',
              transition_condition: {
                type: 'prompt',
                prompt: 'Caller wants to place a pickup order or order food',
              },
              destination_node_id: 'start_order',
            },
            {
              id: 'edge_welcome_question',
              transition_condition: {
                type: 'prompt',
                prompt: 'Caller has a question (hours, location, menu, etc.)',
              },
              destination_node_id: 'faq',
            },
          ],
        },

        // 2) Start Order
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
- Confirm item name, quantity, and any options (spice level, etc.).
- If an item sounds similar to a menu item (like "pow bhaji" for "Pav Bhaji"), confirm: "Did you mean Pav Bhaji?"
- If item not found, offer 2-3 similar menu items instead.
- When the caller says they're done (e.g. "that's it", "nothing else"), stop adding items and move to order_summary.
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

        // 3) Order Summary
        {
          id: 'order_summary',
          type: 'conversation',
          instruction: {
            type: 'prompt',
            text: `
Summarize the full order:
- List all items with quantity and key options.
- Give pickup time (use {{default_pickup_eta}} if not specified).
- Ask for name and callback phone if missing.

Then ask: "Does everything look correct and should I place this order?"

If caller wants changes, go back to start_order.
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

        // 4) Save Order - LLM calls the tool automatically
        {
          id: 'save_order',
          type: 'conversation',
          instruction: {
            type: 'prompt',
            text: `
You MUST NOW call the save_pickup_order tool to save the order.
Pass all collected information:
- customer_name: the caller's name
- customer_phone: their phone number
- items: array of {name, quantity, notes} for each item ordered (USE CANONICAL MENU ITEM NAMES, not mispronounced versions)
- pickup_eta: the estimated pickup time

CALL THE TOOL IMMEDIATELY. Do not say anything until the tool returns a result.
After the tool succeeds, transition to confirm_pickup.
If the tool fails, transition to error_node.
`,
          },
          edges: [
            {
              id: 'edge_save_success',
              transition_condition: {
                type: 'prompt',
                prompt: 'The save_pickup_order tool returned successfully',
              },
              destination_node_id: 'confirm_pickup',
            },
            {
              id: 'edge_save_fail',
              transition_condition: {
                type: 'prompt',
                prompt: 'The save_pickup_order tool failed or returned an error',
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
            text: voiceSettings.closing_en || 
              `Your pickup order is confirmed! We will have it ready in about {{default_pickup_eta}}. Thank you for calling {{restaurant_name}}.`,
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
Politely close the call: "No problem at all, thanks for calling {{restaurant_name}}. If you ever want to order later, just give us a call. Have a great day!"
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
            text: 'Sorry, something went wrong while saving your order. Would you like me to try again?',
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
      ],
      start_node_id: 'welcome',
      tools: [
        {
          type: 'custom',
          name: 'save_pickup_order',
          tool_id: 'save_pickup_order',
          description: 'Save the pickup order to the restaurant system. Call this tool immediately after the customer confirms their order.',
          url: orderWebhookUrl,
          speak_after_execution: true,
          speak_during_execution: true,
          execution_message_description: 'One moment while I place your order...',
          parameters: {
            type: 'object',
            properties: {
              customerName: {
                type: 'string',
                description: 'The customer name for the pickup order',
              },
              customerPhone: {
                type: 'string',
                description: 'The customer phone number',
              },
              items: {
                type: 'array',
                description: 'Array of items in the order',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Menu item name (use canonical name like "Pav Bhaji", not mispronounced versions)' },
                    quantity: { type: 'number', description: 'Quantity ordered' },
                    price: { type: 'number', description: 'Unit price of the item' },
                    spiceLevel: { type: 'string', description: 'Spice level if applicable' },
                  },
                  required: ['name', 'quantity', 'price'],
                },
              },
              subtotal: {
                type: 'number',
                description: 'Order subtotal before tax',
              },
              tax: {
                type: 'number',
                description: 'Tax amount',
              },
              total: {
                type: 'number',
                description: 'Total order amount including tax',
              },
            },
            required: ['customerName', 'customerPhone', 'items', 'subtotal', 'total'],
          },
        },
      ],
    };

    console.log('Creating conversation flow for restaurant:', restaurant.name);

    // Create Conversation Flow via Retell API
    const flowResponse = await fetch('https://api.retellai.com/create-conversation-flow', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(conversationFlowPayload),
    });

    if (!flowResponse.ok) {
      const errorText = await flowResponse.text();
      console.error('Retell flow creation error:', flowResponse.status, errorText);
      throw new Error(`Failed to create conversation flow: ${errorText}`);
    }

    const flowData = await flowResponse.json();
    const conversationFlowId = flowData.conversation_flow_id;

    console.log('Conversation flow created:', conversationFlowId);

    // Now create an agent that uses this conversation flow
    const generalWebhookUrl = `${supabaseUrl}/functions/v1/retell-webhook`;

    // Build agent payload with optional knowledge base and ASR hints
    const agentPayload: Record<string, unknown> = {
      response_engine: {
        type: 'conversation-flow',
        conversation_flow_id: conversationFlowId,
      },
      agent_name: `${restaurant.name} - Voice Assistant`,
      voice_id: '11labs-Adrian',
      language: 'en-US',
      webhook_url: generalWebhookUrl,
    };

    // Add ASR boosted keywords for better recognition of Indian food names
    if (asrHints.length > 0) {
      agentPayload.boosted_keywords = asrHints.slice(0, 100); // Retell may have limits
      console.log(`Added ${Math.min(asrHints.length, 100)} boosted keywords for ASR`);
    }

    // Attach knowledge base if available
    if (restaurant.retell_knowledge_base_id) {
      agentPayload.knowledge_base_ids = [restaurant.retell_knowledge_base_id];
      agentPayload.knowledge_base_config = {
        top_k: 3,
        filter_score: 0.5,
      };
      console.log('Attaching knowledge base:', restaurant.retell_knowledge_base_id);
    }

    console.log('Creating agent with conversation flow...');

    const agentResponse = await fetch('https://api.retellai.com/create-agent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentPayload),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('Retell agent creation error:', agentResponse.status, errorText);
      throw new Error(`Failed to create agent: ${errorText}`);
    }

    const agentData = await agentResponse.json();
    const agentId = agentData.agent_id;

    console.log('Agent created:', agentId);

    // Save both IDs to the database
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        retell_conversation_flow_id: conversationFlowId,
        retell_agent_id: agentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId);

    if (updateError) {
      console.error('Error updating restaurant:', updateError);
      throw new Error('Failed to save agent IDs to database');
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversationFlowId,
        agentId,
        asrHintsCount: asrHints.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in retell-conversation-flow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
