import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationFlowId } = await req.json();
    const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY");

    if (!RETELL_API_KEY) {
      console.error("RETELL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RETELL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conversationFlowId) {
      return new Response(
        JSON.stringify({ error: "Missing conversationFlowId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching conversation flow: ${conversationFlowId}`);

    const response = await fetch(
      `https://api.retellai.com/get-conversation-flow/${conversationFlowId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Retell API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Retell API error: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const flowData = await response.json();
    console.log(`Successfully fetched flow: ${conversationFlowId}`);

    return new Response(
      JSON.stringify({ success: true, flow: flowData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching conversation flow:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
