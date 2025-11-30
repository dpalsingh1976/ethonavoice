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

    // Find restaurant by agent_id
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("retell_agent_id", agentId)
      .maybeSingle();

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

    // Create order items
    if (args.items && Array.isArray(args.items)) {
      const orderItems = args.items.map((item: any) => ({
        order_id: order.id,
        name: item.name,
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
