import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Pronunciation {
  word: string;
  alphabet: string;
  phoneme: string;
}

function parsePLSContent(plsContent: string): Pronunciation[] {
  const pronunciations: Pronunciation[] = [];
  
  // Match lexeme blocks with grapheme and phoneme
  const lexemeRegex = /<lexeme>\s*<grapheme>([^<]+)<\/grapheme>\s*<phoneme>([^<]+)<\/phoneme>\s*<\/lexeme>/gi;
  
  let match;
  while ((match = lexemeRegex.exec(plsContent)) !== null) {
    const word = match[1].trim();
    const phoneme = match[2].trim();
    
    if (word && phoneme) {
      pronunciations.push({
        word,
        alphabet: "ipa",
        phoneme
      });
    }
  }
  
  console.log(`Parsed ${pronunciations.length} pronunciation entries from PLS file`);
  return pronunciations;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurantId, plsContent } = await req.json();

    if (!restaurantId || !plsContent) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing restaurantId or plsContent" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RETELL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "RETELL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch the restaurant to get the agent ID
    const { data: restaurant, error: fetchError } = await supabase
      .from("restaurants")
      .select("retell_agent_id, name")
      .eq("id", restaurantId)
      .single();

    if (fetchError || !restaurant) {
      console.error("Error fetching restaurant:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Restaurant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!restaurant.retell_agent_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No Retell agent configured for this restaurant. Please create a voice flow first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the PLS content
    const pronunciations = parsePLSContent(plsContent);

    if (pronunciations.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid pronunciation entries found in the PLS file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating agent ${restaurant.retell_agent_id} with ${pronunciations.length} pronunciations`);

    // Update the Retell agent with pronunciation dictionary
    const updateResponse = await fetch(`https://api.retellai.com/v2/agent/${restaurant.retell_agent_id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pronunciation_dictionary: pronunciations
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Retell API error:", updateResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Retell API error: ${errorText}` }),
        { status: updateResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updatedAgent = await updateResponse.json();
    console.log("Agent updated successfully:", updatedAgent.agent_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully uploaded ${pronunciations.length} pronunciation entries`,
        count: pronunciations.length,
        agentId: updatedAgent.agent_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in retell-pronunciation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
