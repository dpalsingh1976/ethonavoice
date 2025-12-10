import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { indianMenuDictionary, enrichMenuItemsWithVariants, normalizeTranscriptToMenuItems } from "../_shared/menuDictionary.ts";

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
    console.log("=== Retell Create Order Webhook Invoked ===");
    
    const payload = await req.json();
    console.log("Received payload:", JSON.stringify(payload, null, 2));

    // Retell custom function payload format: { call: {...}, args: {...}, data: { call_id: "..." } }
    const args = payload.args;
    const callId = payload.data?.call_id;
    const agentId = payload.call?.agent_id;

    if (!args) {
      console.error("Missing args in payload");
      return new Response(JSON.stringify({ 
        result: "Error: Missing order data" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!agentId) {
      console.error("No agent_id in payload");
      return new Response(JSON.stringify({ 
        result: "Error: Unable to identify restaurant" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Order args:", JSON.stringify(args, null, 2));
    console.log("Call ID:", callId);
    console.log("Agent ID:", agentId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find restaurant by agent_id - first try exact match
    let { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("retell_agent_id", agentId)
      .maybeSingle();

    // If not found, try searching in retell_agent_ids array
    if (!restaurant) {
      console.log("Agent not found in retell_agent_id, checking retell_agent_ids array...");
      const { data: restaurants, error: arrayError } = await supabase
        .from("restaurants")
        .select("*")
        .filter("retell_agent_ids", "cs", JSON.stringify([agentId]));
      
      if (arrayError) {
        console.error("Error searching retell_agent_ids:", arrayError);
      } else if (restaurants && restaurants.length > 0) {
        restaurant = restaurants[0];
        console.log("Found restaurant via retell_agent_ids array:", restaurant.name);
      }
    }

    if (restaurantError || !restaurant) {
      console.error("Restaurant not found for agent:", agentId, restaurantError);
      return new Response(JSON.stringify({ 
        result: "Error: Restaurant not found" 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Found restaurant:", restaurant.name);

    // Fetch menu items to build normalization dictionary
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("id, name, category_id")
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true);

    // Enrich with phonetic variants
    const enrichedMenuItems = enrichMenuItemsWithVariants(
      menuItems || [],
      indianMenuDictionary
    );

    // Normalize item names in the order
    const normalizedItems = args.items?.map((item: any) => {
      const originalName = item.name;
      const normResult = normalizeTranscriptToMenuItems(originalName, enrichedMenuItems, 0.7);
      
      if (normResult.matches.length > 0) {
        const bestMatch = normResult.matches[0];
        console.log(`Normalized item: "${originalName}" -> "${bestMatch.canonicalName}" (similarity: ${bestMatch.similarity.toFixed(2)})`);
        return {
          ...item,
          name: bestMatch.canonicalName,
          original_name: originalName // Keep original for logging
        };
      }
      
      return item;
    }) || [];

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        source: "voice_agent",
        customer_name: args.customerName,
        customer_phone: args.customerPhone,
        customer_address: args.customerAddress || null,
        subtotal: args.subtotal,
        tax: args.tax || 0,
        total_amount: args.total,
        currency: "USD",
        language_used: "en",
        status: "new"
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return new Response(JSON.stringify({ 
        result: "Error: Failed to create order. Please try again." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Order created successfully:", order.id);

    // Create order items with normalized names
    if (normalizedItems.length > 0) {
      const orderItems = normalizedItems.map((item: any) => ({
        order_id: order.id,
        name: item.name, // Use normalized name
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        notes: item.spiceLevel ? `Spice: ${item.spiceLevel}` : null
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("Error creating order items:", itemsError);
        return new Response(JSON.stringify({ 
          result: `Order ${order.id} created but some items failed to save. Please contact the restaurant.` 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log("Order items created:", orderItems.length);
    }

    // Return success result in Retell's expected format
    const orderNumber = order.id.substring(0, 8).toUpperCase();
    const successMessage = `Perfect! Your order has been placed successfully. Your order number is ${orderNumber}. The total is $${args.total.toFixed(2)}. Thank you for your order!`;
    
    console.log("Returning success response to Retell:", successMessage);
    
    return new Response(JSON.stringify({ 
      result: successMessage
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in retell-create-order function:", error);
    return new Response(JSON.stringify({ 
      result: "Error: An unexpected error occurred. Please try again or call us directly." 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
