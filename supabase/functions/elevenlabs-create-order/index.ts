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
    console.log("=== ElevenLabs Create Order Webhook Invoked ===");
    
    const payload = await req.json();
    console.log("Received payload:", JSON.stringify(payload, null, 2));

    // ElevenLabs conversational AI tool call format
    // Expected format: { agent_id: "...", conversation_id: "...", parameters: {...} }
    const agentId = payload.agent_id;
    const conversationId = payload.conversation_id;
    const parameters = payload.parameters || payload.args || payload;

    // Extract order data from parameters
    const orderData = {
      customerName: parameters.customerName || parameters.customer_name,
      customerPhone: parameters.customerPhone || parameters.customer_phone,
      customerAddress: parameters.customerAddress || parameters.customer_address,
      items: parameters.items || [],
      subtotal: parameters.subtotal || 0,
      tax: parameters.tax || 0,
      total: parameters.total || parameters.total_amount || 0,
    };

    if (!orderData.customerName || !orderData.customerPhone) {
      console.error("Missing required customer info");
      return new Response(JSON.stringify({ 
        success: false,
        error: "Missing customer name or phone number" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Order data:", JSON.stringify(orderData, null, 2));
    console.log("Agent ID:", agentId);
    console.log("Conversation ID:", conversationId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find restaurant by ElevenLabs agent_id
    // First try elevenlabs_agent_id column if it exists
    let restaurant = null;
    let restaurantError = null;

    if (agentId) {
      // Try to find by elevenlabs_agent_id
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("elevenlabs_agent_id", agentId)
        .maybeSingle();
      
      if (data) {
        restaurant = data;
      } else {
        // Fallback: check if agent_id is stored in retell_agent_ids array (for multi-provider setup)
        const { data: restaurants, error: arrayError } = await supabase
          .from("restaurants")
          .select("*")
          .filter("elevenlabs_agent_ids", "cs", JSON.stringify([agentId]));
        
        if (restaurants && restaurants.length > 0) {
          restaurant = restaurants[0];
        }
      }
    }

    // If still not found, try using restaurant_id from payload if provided
    if (!restaurant && parameters.restaurant_id) {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", parameters.restaurant_id)
        .maybeSingle();
      
      if (data) {
        restaurant = data;
      }
      restaurantError = error;
    }

    if (!restaurant) {
      console.error("Restaurant not found for agent:", agentId);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Restaurant not found" 
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
    const normalizedItems = orderData.items?.map((item: any) => {
      const originalName = item.name;
      const normResult = normalizeTranscriptToMenuItems(originalName, enrichedMenuItems, 0.7);
      
      if (normResult.matches.length > 0) {
        const bestMatch = normResult.matches[0];
        console.log(`Normalized item: "${originalName}" -> "${bestMatch.canonicalName}" (similarity: ${bestMatch.similarity.toFixed(2)})`);
        return {
          ...item,
          name: bestMatch.canonicalName,
          original_name: originalName
        };
      }
      
      return item;
    }) || [];

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        source: "elevenlabs_voice",
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        customer_address: orderData.customerAddress || null,
        subtotal: orderData.subtotal,
        tax: orderData.tax || 0,
        total_amount: orderData.total,
        currency: "USD",
        language_used: parameters.language || "en",
        status: "new"
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to create order. Please try again." 
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
        name: item.name,
        quantity: item.quantity || 1,
        unit_price: item.price || item.unit_price || 0,
        total_price: (item.price || item.unit_price || 0) * (item.quantity || 1),
        notes: item.spiceLevel ? `Spice: ${item.spiceLevel}` : (item.notes || null)
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("Error creating order items:", itemsError);
        return new Response(JSON.stringify({ 
          success: true,
          order_id: order.id,
          message: `Order created but some items failed to save.`
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log("Order items created:", orderItems.length);
    }

    // Return success response in ElevenLabs expected format
    const orderNumber = order.id.substring(0, 8).toUpperCase();
    const successMessage = `Your order has been placed successfully. Your order number is ${orderNumber}. The total is $${orderData.total.toFixed(2)}. Thank you for your order!`;
    
    console.log("Returning success response:", successMessage);
    
    return new Response(JSON.stringify({ 
      success: true,
      order_id: order.id,
      order_number: orderNumber,
      total: orderData.total,
      message: successMessage
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in elevenlabs-create-order function:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: "An unexpected error occurred. Please try again." 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
