import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhook tool schema definition - this is what gets pushed to ElevenLabs
const WEBHOOK_TOOL_CONFIG = {
  name: "webhook_tool",
  description: "Send events to backend systems when important actions occur. Use this to send order confirmations, lead captures, inquiries, and other important events to the restaurant's backend. Only call this when an important event occurs like order confirmed, booking completed, or lead captured. Do NOT call for casual questions or menu inquiries.",
  type: "webhook",
  webhook: {
    url: "", // Will be set dynamically
    request_headers: {
      "Content-Type": "application/json"
    },
    secrets: [] as { name: string; value: string }[],
    request_body: {
      eventType: "<string, required: Type of event - order_confirmed, lead_captured, inquiry_logged, booking_completed>",
      sessionId: "<string, optional: The conversation/call session identifier>",
      agent_id: "<string, required: The ElevenLabs agent ID for restaurant lookup>",
      payload: {
        customerName: "<string: Customer's name>",
        phone: "<string: Customer's phone number>",
        items: "<array: List of order items with name, qty, price>",
        subtotal: "<number: Order subtotal>",
        tax: "<number: Tax amount>",
        total: "<number: Total amount>",
        pickupTime: "<string: Requested pickup time>",
        notes: "<string: Any special notes or requests>"
      }
    }
  }
};

// Input parameters schema for the tool
const TOOL_PARAMETERS = {
  type: "object",
  properties: {
    eventType: {
      type: "string",
      description: "Type of event triggering the webhook (e.g., order_confirmed, order_created, lead_captured, inquiry_logged)"
    },
    sessionId: {
      type: "string",
      description: "Conversation or call session identifier"
    },
    payload: {
      type: "object",
      description: "Dynamic data being sent to backend (order details, customer info, totals, etc.)",
      properties: {
        customerName: { type: "string", description: "Customer's name" },
        phone: { type: "string", description: "Customer's phone number" },
        items: {
          type: "array",
          description: "List of order items",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              qty: { type: "number" },
              price: { type: "number" }
            }
          }
        },
        subtotal: { type: "number", description: "Order subtotal" },
        tax: { type: "number", description: "Tax amount" },
        total: { type: "number", description: "Total order amount" },
        pickupTime: { type: "string", description: "Requested pickup time" },
        notes: { type: "string", description: "Special instructions or notes" }
      }
    }
  },
  required: ["eventType", "payload"]
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { restaurantId, agentId } = await req.json();

    if (!restaurantId || !agentId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "restaurantId and agentId are required" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Configuring webhook tool for agent: ${agentId}, restaurant: ${restaurantId}`);

    // Construct the webhook URL for this restaurant
    const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook-tool`;

    // Build the tool configuration
    const toolConfig = {
      ...WEBHOOK_TOOL_CONFIG,
      webhook: {
        ...WEBHOOK_TOOL_CONFIG.webhook,
        url: webhookUrl,
        request_body: {
          eventType: "{{eventType}}",
          sessionId: "{{sessionId}}",
          agent_id: agentId,
          payload: "{{payload}}"
        }
      }
    };

    // First, get the current agent configuration
    console.log("Fetching current agent configuration...");
    const getAgentResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!getAgentResponse.ok) {
      const errorText = await getAgentResponse.text();
      console.error("Failed to fetch agent:", getAgentResponse.status, errorText);
      throw new Error(`Failed to fetch agent: ${getAgentResponse.status} - ${errorText}`);
    }

    const currentAgent = await getAgentResponse.json();
    console.log("Current agent configuration retrieved");

    // Get existing tools and check if webhook_tool already exists
    const existingTools = currentAgent.conversation_config?.agent?.prompt?.tools || [];
    const webhookToolIndex = existingTools.findIndex(
      (tool: any) => tool.name === "webhook_tool"
    );

    let updatedTools;
    if (webhookToolIndex >= 0) {
      // Update existing webhook tool
      updatedTools = [...existingTools];
      updatedTools[webhookToolIndex] = toolConfig;
      console.log("Updating existing webhook_tool");
    } else {
      // Add new webhook tool
      updatedTools = [...existingTools, toolConfig];
      console.log("Adding new webhook_tool");
    }

    // Update the agent with the new tool configuration
    console.log("Updating agent with webhook tool...");
    const updateResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_config: {
            agent: {
              prompt: {
                tools: updatedTools
              }
            }
          }
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Failed to update agent:", updateResponse.status, errorText);
      throw new Error(`Failed to update agent: ${updateResponse.status} - ${errorText}`);
    }

    const updatedAgent = await updateResponse.json();
    console.log("Agent updated successfully");

    // Update restaurant record with the agent ID if not already set
    await supabase
      .from("restaurants")
      .update({ 
        elevenlabs_agent_id: agentId,
        updated_at: new Date().toISOString()
      })
      .eq("id", restaurantId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook tool configured successfully",
        agentId: updatedAgent.agent_id,
        toolsCount: updatedTools.length,
        webhookUrl: webhookUrl
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error configuring webhook tool:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
