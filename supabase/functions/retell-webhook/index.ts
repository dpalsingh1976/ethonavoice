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
    const payload = await req.json();
    console.log('Received Retell webhook:', JSON.stringify(payload, null, 2));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle real-time tool calls (during conversation)
    if (payload.tool_name === 'create_order' && payload.args) {
      console.log('Processing real-time create_order tool call');
      
      const args = typeof payload.args === 'string' ? JSON.parse(payload.args) : payload.args;
      const callId = payload.call_id;
      
      // Get call details to find agent_id
      if (!callId) {
        console.error('No call_id provided in tool call');
        return new Response(JSON.stringify({ success: false, error: 'Missing call_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find restaurant by call's agent_id from the call analysis
      const agentId = payload.agent_id;
      if (!agentId) {
        console.error('No agent_id in payload');
        return new Response(JSON.stringify({ success: false, error: 'Missing agent_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('retell_agent_id', agentId)
        .maybeSingle();

      if (restaurantError || !restaurant) {
        console.error('Restaurant not found for agent:', agentId, restaurantError);
        return new Response(JSON.stringify({ success: false, error: 'Restaurant not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Found restaurant:', restaurant.name);
      console.log('Creating order with data:', JSON.stringify(args, null, 2));

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurant.id,
          source: 'voice_agent',
          customer_name: args.customerName,
          customer_phone: args.customerPhone,
          customer_address: args.customerAddress || null,
          subtotal: args.subtotal,
          tax: args.tax || 0,
          total_amount: args.total,
          currency: 'USD',
          language_used: 'en',
          status: 'new'
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to create order' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Order created:', order.id);

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
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          return new Response(JSON.stringify({ success: false, error: 'Order created but items failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('Order items created:', orderItems.length);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        order_id: order.id,
        message: 'Order created successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only process call_ended events with transcript data (fallback)
    if (payload.event !== 'call_ended' || !payload.call) {
      console.log('Skipping event:', payload.event);
      return new Response(null, { status: 204 });
    }

    const call = payload.call;
    const agentId = call.agent_id;
    const transcript = call.transcript_with_tool_calls || [];

    console.log('Processing call_ended for agent:', agentId);

    // Find restaurant by agent ID
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('retell_agent_id', agentId)
      .maybeSingle();

    if (restaurantError) {
      console.error('Error finding restaurant:', restaurantError);
      return new Response(null, { status: 204 });
    }

    if (!restaurant) {
      console.log('No restaurant found for agent:', agentId);
      return new Response(null, { status: 204 });
    }

    console.log('Found restaurant:', restaurant.name);

    // Extract tool calls from transcript
    const toolCalls = transcript
      .filter((t: any) => t.role === 'agent' && t.tool_calls && Array.isArray(t.tool_calls))
      .flatMap((t: any) => t.tool_calls);

    console.log('Tool calls found:', toolCalls.length);

    // Process each create_order function call
    const orderCalls = toolCalls.filter((tc: any) => tc.name === 'create_order' || tc.function === 'create_order');

    if (orderCalls.length === 0) {
      console.log('No order function calls found in transcript');
      return new Response(null, { status: 204 });
    }

    console.log('Order function calls found:', orderCalls.length);

    for (const toolCall of orderCalls) {
      try {
        // Parse arguments - Retell may send as string or object
        const args = typeof toolCall.arguments === 'string' 
          ? JSON.parse(toolCall.arguments)
          : toolCall.arguments;

        console.log('Processing order:', JSON.stringify(args, null, 2));

        // Create order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            restaurant_id: restaurant.id,
            source: 'voice_agent',
            customer_name: args.customerName,
            customer_phone: args.customerPhone,
            customer_address: args.customerAddress || null,
            subtotal: args.subtotal,
            tax: args.tax || 0,
            total_amount: args.total,
            currency: 'USD',
            language_used: 'en',
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
            .from('order_items')
            .insert(orderItems);

          if (itemsError) {
            console.error('Error creating order items:', itemsError);
          } else {
            console.log('Order items created:', orderItems.length);
          }
        }
      } catch (error) {
        console.error('Error processing order call:', error);
      }
    }

    return new Response(null, { status: 204 });

  } catch (error) {
    console.error('Error in retell-webhook:', error);
    return new Response(null, { status: 204 });
  }
});
