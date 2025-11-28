import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurantId, systemPrompt } = await req.json();

    if (!restaurantId || !systemPrompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing restaurantId or systemPrompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const retellApiKey = Deno.env.get('RETELL_API_KEY');
    if (!retellApiKey) {
      console.error('RETELL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Retell API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      console.error('Restaurant not found:', restaurantError);
      return new Response(
        JSON.stringify({ success: false, error: 'Restaurant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent already exists
    const existingAgentId = restaurant.retell_agent_id;

    // Prepare webhook URL
    const webhookUrl = `${supabaseUrl}/functions/v1/retell-webhook`;
    
    // Step 1: Create or update Retell LLM with system prompt and tools
    const llmConfig = {
      general_prompt: systemPrompt,
      begin_message: "Hello! How can I help you today?",
      model: "gpt-4o-mini",
      start_speaker: "agent",
      general_tools: [
        {
          type: "end_call",
          name: "end_call",
          description: "End the call when conversation is finished"
        },
        {
          type: "custom",
          name: "create_order",
          description: "Create a new order when customer confirms their complete order",
          url: webhookUrl,
          method: "POST",
          speak_after_execution: true,
          speak_during_execution: false,
          parameters: {
            type: "object",
            properties: {
              customerName: {
                type: "string",
                description: "Full name of the customer"
              },
              customerPhone: {
                type: "string",
                description: "Phone number of the customer"
              },
              customerAddress: {
                type: "string",
                description: "Delivery address (empty for pickup)"
              },
              items: {
                type: "array",
                description: "Array of ordered items",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "number" },
                    price: { type: "number" },
                    spiceLevel: { type: "string" }
                  },
                  required: ["name", "quantity", "price"]
                }
              },
              subtotal: {
                type: "number",
                description: "Sum of all items before tax"
              },
              tax: {
                type: "number",
                description: "Tax amount"
              },
              total: {
                type: "number",
                description: "Final total amount"
              }
            },
            required: ["customerName", "customerPhone", "items", "subtotal", "tax", "total"]
          }
        }
      ]
    };

    console.log('Creating/updating Retell LLM...');
    const llmResponse = await fetch('https://api.retellai.com/create-retell-llm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(llmConfig),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('Retell LLM API error:', llmResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Retell LLM API error: ${llmResponse.status} - ${errorText}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const llmId = llmData.llm_id;
    console.log('Retell LLM created:', llmId);

    // Step 2: Create or update agent with the LLM
    const agentConfig = {
      agent_name: `${restaurant.name} - Voice Assistant`,
      voice_id: "21m00Tcm4TlvDq8ikWAM",
      language: "en-US",
      response_engine: {
        type: "retell-llm",
        llm_id: llmId
      },
      enable_backchannel: true,
      webhook_url: webhookUrl,
      boosted_keywords: ["order", "delivery", "pickup", "spice", "vegetarian"]
    };

    let agentId: string;
    let method: string;
    let url: string;

    if (existingAgentId) {
      // Update existing agent
      method = 'PATCH';
      url = `https://api.retellai.com/update-agent/${existingAgentId}`;
      agentId = existingAgentId;
      console.log('Updating existing Retell agent:', agentId);
    } else {
      // Create new agent
      method = 'POST';
      url = 'https://api.retellai.com/create-agent';
      console.log('Creating new Retell agent');
    }

    const retellResponse = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error('Retell API error:', retellResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Retell API error: ${retellResponse.status} - ${errorText}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const retellData = await retellResponse.json();
    agentId = retellData.agent_id;

    console.log('Retell agent created/updated:', agentId);

    // Update restaurant with agent ID
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ retell_agent_id: agentId })
      .eq('id', restaurantId);

    if (updateError) {
      console.error('Error updating restaurant with agent ID:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save agent ID to database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        agentId,
        message: existingAgentId ? 'Agent updated successfully' : 'Agent created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in retell-agent function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
