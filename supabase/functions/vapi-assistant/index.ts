import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to generate system prompt
function generateSystemPrompt(
  restaurant: any,
  voiceSettings: any,
  hours: any[],
  categories: any[],
  items: any[]
): string {
  // Format hours
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const formattedHours = hours
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map(h => {
      const day = daysOfWeek[h.day_of_week];
      return h.is_closed ? `${day}: Closed` : `${day}: ${h.open_time} - ${h.close_time}`;
    })
    .join('\n');

  // Format menu
  let menuText = '';
  const categoriesMap = new Map();
  items.filter(i => i.is_available).forEach(item => {
    const catId = item.category_id || 'uncategorized';
    if (!categoriesMap.has(catId)) categoriesMap.set(catId, []);
    categoriesMap.get(catId).push(item);
  });

  categories.forEach(cat => {
    const catItems = categoriesMap.get(cat.id);
    if (catItems?.length) {
      menuText += `\n## ${cat.name}\n`;
      catItems.forEach((item: any) => {
        menuText += `- ${item.name}`;
        if (item.description) menuText += ` - ${item.description}`;
        menuText += ` - ₹${item.price}`;
        if (item.is_vegetarian) menuText += ' (Veg)';
        if (item.spice_level_options) menuText += ` - Spice: ${item.spice_level_options.join(', ')}`;
        menuText += '\n';
      });
    }
  });

  return `You are an AI voice assistant for ${restaurant.name}, a restaurant located at ${restaurant.address}.

## SUPPORTED LANGUAGES
You support English (en), Hindi (hi), Punjabi (pa), and Gujarati (gu).
- Auto-detect the language from the caller's first words
- Respond in the same language throughout the conversation
- If language is unclear, politely ask: "Would you prefer English, Hindi, Punjabi, or Gujarati?"

## GREETINGS (by language)
English: ${voiceSettings.greeting_en || 'Welcome! How can I help you?'}
Hindi: ${voiceSettings.greeting_hi || 'नमस्ते! मैं कैसे मदद कर सकता हूं?'}
Punjabi: ${voiceSettings.greeting_pa || 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ?'}
Gujarati: ${voiceSettings.greeting_gu || 'નમસ્તે! હું કેવી રીતે મદદ કરી શકું?'}

## RESTAURANT INFORMATION
- Phone: ${restaurant.phone}
- Address: ${restaurant.address}
- Timezone: ${restaurant.timezone}

## RESTAURANT HOURS
${formattedHours || 'Hours not set'}

## MENU
${menuText || 'Menu not configured'}

## YOUR RESPONSIBILITIES
1. Answer questions about menu, prices, hours, location
2. Take phone orders for pickup or delivery
3. Collect: customer name, phone, address (if delivery), items, quantities, spice level
4. Confirm order details and approximate total before completing
5. Be polite, patient, and helpful with an Indian hospitality tone

## CONSTRAINTS
- Never take payment information over phone
- Only offer items that are on the menu
- If unsure about anything, inform caller that a staff member will call back
- Never make up information not provided here
- Always ask about spice level preference for items that offer it

## SPECIAL INSTRUCTIONS
${voiceSettings.notes_for_agent || 'None'}

## CLOSING MESSAGES (by language)
English: ${voiceSettings.closing_en || 'Thank you for calling!'}
Hindi: ${voiceSettings.closing_hi || 'कॉल करने के लिए धन्यवाद!'}
Punjabi: ${voiceSettings.closing_pa || 'ਕਾਲ ਕਰਨ ਲਈ ਧੰਨਵਾਦ!'}
Gujarati: ${voiceSettings.closing_gu || 'કૉલ કરવા બદલ આભાર!'}
`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY is not configured');
    }

    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { restaurantId, systemPrompt: customSystemPrompt } = await req.json();
    if (!restaurantId) {
      throw new Error('restaurantId is required');
    }

    // Verify user owns this restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('owner_id', user.id)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found or access denied');
    }

    // Fetch all required data
    const [voiceSettingsResult, hoursResult, categoriesResult, itemsResult] = await Promise.all([
      supabase.from('restaurant_voice_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
      supabase.from('restaurant_hours').select('*').eq('restaurant_id', restaurantId),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId)
    ]);

    const voiceSettings = voiceSettingsResult.data || {};
    const hours = hoursResult.data || [];
    const categories = categoriesResult.data || [];
    const items = itemsResult.data || [];

    // Use custom system prompt if provided, otherwise generate it
    const systemPrompt = customSystemPrompt || generateSystemPrompt(restaurant, voiceSettings, hours, categories, items);

    console.log('Creating/updating VAPI assistant for restaurant:', restaurant.name);

    // Call VAPI API to create/update assistant
    const vapiUrl = restaurant.vapi_assistant_id 
      ? `https://api.vapi.ai/assistant/${restaurant.vapi_assistant_id}`
      : 'https://api.vapi.ai/assistant';
    
    const vapiMethod = restaurant.vapi_assistant_id ? 'PATCH' : 'POST';

    const vapiResponse = await fetch(vapiUrl, {
      method: vapiMethod,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${restaurant.name} - Voice Assistant`,
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: systemPrompt
          }]
        },
        voice: {
          provider: '11labs',
          voiceId: '21m00Tcm4TlvDq8ikWAM' // Default ElevenLabs voice
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'multi' // Multi-language support
        },
        firstMessage: voiceSettings.greeting_en || 'Welcome! How can I help you today?',
      })
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error('VAPI API error:', vapiResponse.status, errorText);
      throw new Error(`VAPI API error: ${vapiResponse.status} - ${errorText}`);
    }

    const vapiData = await vapiResponse.json();
    const assistantId = vapiData.id;

    console.log('VAPI assistant created/updated:', assistantId);

    // Update restaurant with assistant ID
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ vapi_assistant_id: assistantId })
      .eq('id', restaurantId);

    if (updateError) {
      console.error('Error updating restaurant with assistant ID:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        assistantId,
        message: 'VAPI assistant created/updated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in vapi-assistant function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        message: 'Failed to create/update VAPI assistant'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
