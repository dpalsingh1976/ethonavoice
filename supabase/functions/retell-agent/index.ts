// supabase/functions/retell-agent/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Retell from "https://esm.sh/retell-sdk@latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { restaurantId, systemPrompt } = await req.json().catch((err) => {
      console.error("Invalid JSON body:", err);
      throw new Error("Invalid request body");
    });

    if (!restaurantId || !systemPrompt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing restaurantId or systemPrompt",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Env vars
    const retellApiKey = Deno.env.get("RETELL_API_KEY");
    if (!retellApiKey) {
      console.error("RETELL_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Retell API key not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Supabase environment not configured correctly",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      console.error("Restaurant not found:", restaurantError);
      return new Response(JSON.stringify({ success: false, error: "Restaurant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingAgentId: string | null = restaurant.retell_agent_id ?? null;

    // Webhook URL for Retell to call back into
    const webhookUrl = `${supabaseUrl}/functions/v1/retell-webhook`;

    // Initialize Retell client
    const retellClient = new Retell({
      apiKey: retellApiKey,
    });

    // --------------------------
    // Step 1: Create Retell LLM
    // --------------------------
    console.log("Creating/updating Retell LLM...");
    const llmData = await retellClient.llm.create({
      general_prompt: systemPrompt,
      begin_message: "Hello! How can I help you today?",
      model: "gpt-4o-mini",
      general_tools: [
        {
          type: "end_call",
          name: "end_call",
          description: "End the call when conversation is finished",
        },
        {
          type: "custom",
          name: "create_order",
          description: "Create a new order when customer confirms their complete order",
          url: webhookUrl,
          speak_after_execution: true,
          speak_during_execution: false,
          parameters: {
            type: "object",
            properties: {
              customerName: {
                type: "string",
                description: "Full name of the customer",
              },
              customerPhone: {
                type: "string",
                description: "Phone number of the customer",
              },
              customerAddress: {
                type: "string",
                description: "Delivery address (empty for pickup)",
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
                    spiceLevel: { type: "string" },
                  },
                  required: ["name", "quantity", "price"],
                },
              },
              subtotal: {
                type: "number",
                description: "Sum of all items before tax",
              },
              tax: {
                type: "number",
                description: "Tax amount",
              },
              total: {
                type: "number",
                description: "Final total amount",
              },
            },
            required: ["customerName", "customerPhone", "items", "subtotal", "tax", "total"],
          },
        },
      ],
    });

    const llmId = llmData.llm_id;

    if (!llmId) {
      console.error("Retell LLM response missing llm_id:", llmData);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to get llm_id from Retell",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Retell LLM created:", llmId);

    // -------------------------------------------
    // Step 2: Create or update Retell Agent
    // -------------------------------------------
    const agentConfig = {
      response_engine: {
        type: "retell-llm" as const,
        llm_id: llmId,
      },
      agent_name: `${restaurant.name} - Voice Assistant`,
      voice_id: "11labs-Adrian",
      language: "en-US" as const,
      webhook_url: webhookUrl,
    };

    let agentId: string | null = existingAgentId;

    try {
      let agentData;
      
      if (agentId) {
        // Update existing agent
        console.log("Updating existing Retell agent:", agentId);
        try {
          agentData = await retellClient.agent.update(agentId, agentConfig);
          console.log("Retell agent updated:", agentData.agent_id);
        } catch (updateError: any) {
          // If agent not found, create a new one
          if (updateError?.status === 404) {
            console.warn("Retell agent not found for update; falling back to create");
            agentData = await retellClient.agent.create(agentConfig);
            console.log("Retell agent created:", agentData.agent_id);
          } else {
            throw updateError;
          }
        }
      } else {
        // Create new agent
        console.log("Creating new Retell agent");
        agentData = await retellClient.agent.create(agentConfig);
        console.log("Retell agent created:", agentData.agent_id);
      }

      agentId = agentData.agent_id;

      if (!agentId) {
        console.error("Retell Agent response missing agent_id:", agentData);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to get agent_id from Retell",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Save agent_id to database
      console.log("Saving agent_id to database:", agentId);
      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ retell_agent_id: agentId })
        .eq("id", restaurantId);

      if (updateError) {
        console.error("Failed to update restaurant with agent_id:", updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Agent created but failed to save to database",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log("Agent ID saved to database successfully");
    } catch (error: any) {
      console.error("Retell Agent API error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      console.error("Error status:", error?.status);
      console.error("Error response:", error?.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Retell Agent API error: ${error.message || "Unknown error"}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        agentId,
        message: existingAgentId ? "Agent updated successfully" : "Agent created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in retell-agent function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
