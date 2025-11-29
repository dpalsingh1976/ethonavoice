// supabase/functions/retell-agent/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // --------------------------
    // Step 1: Create Retell LLM
    // --------------------------
    const llmConfig = {
      general_prompt: systemPrompt,
      begin_message: "Hello! How can I help you today?",
      model: "gpt-4o-mini",
      start_speaker: "agent",
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
          method: "POST",
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
    };

    console.log("Creating/updating Retell LLM...");
    const llmResponse = await fetch("https://api.retellai.com/create-retell-llm", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(llmConfig),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error("Retell LLM API error:", llmResponse.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Retell LLM API error: ${llmResponse.status} - ${errorText}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const llmData = await llmResponse.json();
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
      agent_name: `${restaurant.name} - Voice Assistant`,
      voice_id: "21m00Tcm4TlvDq8ikWAM", // Make sure this voice_id exists in your Retell workspace
      language: "en-US",
      response_engine: {
        type: "retell-llm",
        llm_id: llmId,
      },
      enable_backchannel: true,
      webhook_url: webhookUrl,
      boosted_keywords: ["order", "delivery", "pickup", "spice", "vegetarian"],
    };

    let agentId: string | null = existingAgentId;
    let method: "POST" | "PATCH" = agentId ? "PATCH" : "POST";
    let agentUrl =
      method === "PATCH" ? `https://api.retellai.com/agent/${agentId}` : "https://api.retellai.com/agent";

    console.log("Retell Agent API request:", {
      method,
      url: agentUrl,
      hasExistingAgentId: !!existingAgentId,
    });

    let retellResponse = await fetch(agentUrl, {
      method,
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(agentConfig),
    });

    console.log("Retell Agent API response status:", retellResponse.status);

    // If updating and we get 404, the agent doesn't exist anymore -> fallback to create
    if (method === "PATCH" && retellResponse.status === 404) {
      const errorText = await retellResponse.text();
      console.warn("Retell agent not found for update; falling back to create. Response:", errorText);

      method = "POST";
      agentUrl = "https://api.retellai.com/agent";

      retellResponse = await fetch(agentUrl, {
        method,
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(agentConfig),
      });

      console.log("Retell Agent API response status after create fallback:", retellResponse.status);
    }

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error("Retell Agent API error:", retellResponse.status, errorText);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Retell Agent API error: ${retellResponse.status} - ${errorText}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const retellData = await retellResponse.json();
    agentId = retellData.agent_id;

    if (!agentId) {
      console.error("Retell Agent response missing agent_id:", retellData);
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

    console.log("Retell agent created/updated:", agentId);

    // Save agent ID back to the restaurant record
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({ retell_agent_id: agentId })
      .eq("id", restaurantId);

    if (updateError) {
      console.error("Error updating restaurant with agent ID:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to save agent ID to database",
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
