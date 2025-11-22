import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('VAPI webhook received:', JSON.stringify(payload, null, 2));

    // Create Supabase client with service role for database writes
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different message types
    if (payload.message?.type === 'end-of-call-report') {
      console.log('Processing end-of-call-report');
      
      // Extract call data
      const call = payload.message.call;
      const analysis = payload.message.analysis;
      
      // Look for function calls in the call that created an order
      const functionCalls = payload.message.messages?.filter((msg: any) => 
        msg.role === 'function_call' && msg.name === 'create_order'
      ) || [];

      console.log('Function calls found:', functionCalls.length);

      // Process each order function call
      for (const funcCall of functionCalls) {
        try {
          const orderData = typeof funcCall.arguments === 'string' 
            ? JSON.parse(funcCall.arguments) 
            : funcCall.arguments;

          console.log('Processing order data:', JSON.stringify(orderData, null, 2));

          // Find restaurant by phone number from the call
          const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id')
            .eq('phone', call.phoneNumber?.number || call.customer?.number)
            .single();

          if (restaurantError || !restaurant) {
            console.error('Restaurant not found for phone:', call.phoneNumber?.number, restaurantError);
            continue;
          }

          console.log('Found restaurant:', restaurant.id);

          // Create order
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              restaurant_id: restaurant.id,
              source: 'voice_agent',
              customer_name: orderData.customerName,
              customer_phone: orderData.customerPhone,
              customer_address: orderData.customerAddress || null,
              subtotal: orderData.subtotal,
              tax: orderData.tax || 0,
              total_amount: orderData.total,
              currency: 'USD',
              language_used: call.language || 'en',
              status: 'new'
            })
            .select()
            .single();

          if (orderError) {
            console.error('Error creating order:', orderError);
            continue;
          }

          console.log('Order created:', order.id);

          // Create order items
          if (orderData.items && Array.isArray(orderData.items)) {
            const orderItems = orderData.items.map((item: any) => ({
              order_id: order.id,
              name: `${item.name}${item.spiceLevel ? ' (' + item.spiceLevel + ')' : ''}`,
              quantity: item.quantity,
              unit_price: item.price,
              total_price: item.quantity * item.price,
              notes: item.spiceLevel ? `Spice level: ${item.spiceLevel}` : null
            }));

            const { error: itemsError } = await supabase
              .from('order_items')
              .insert(orderItems);

            if (itemsError) {
              console.error('Error creating order items:', itemsError);
            } else {
              console.log('Order items created:', orderItems.length);
            }
          }

        } catch (error) {
          console.error('Error processing order function call:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in vapi-webhook function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
