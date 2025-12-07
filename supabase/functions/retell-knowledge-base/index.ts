import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KnowledgeBaseText {
  title: string;
  text: string;
}

function parseQAContent(rtfContent: string): KnowledgeBaseText[] {
  // Remove RTF formatting - extract plain text
  let plainText = rtfContent
    .replace(/\{\\rtf1[^}]*\}/g, '') // Remove RTF header
    .replace(/\\[a-z]+\d*\s?/g, '') // Remove RTF commands
    .replace(/\{[^}]*\}/g, '') // Remove nested groups
    .replace(/\\'[0-9a-f]{2}/g, '') // Remove hex escapes
    .replace(/\\\\/g, '') // Remove escaped backslashes
    .replace(/\\$/gm, '\n') // Convert RTF line breaks
    .trim();
  
  // If still has RTF markers, try simpler extraction
  if (plainText.includes('\\') || plainText.includes('{')) {
    // Extract just Q: and A: lines
    const lines = rtfContent.split(/\\$|\\par|[\r\n]+/);
    plainText = lines
      .map(line => line.replace(/[{}\\][a-z0-9]*/gi, '').trim())
      .filter(line => line.startsWith('Q:') || line.startsWith('A:'))
      .join('\n');
  }

  const qaItems: KnowledgeBaseText[] = [];
  const lines = plainText.split('\n').filter(line => line.trim());
  
  let currentQuestion = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('Q:')) {
      currentQuestion = trimmedLine.substring(2).trim();
    } else if (trimmedLine.startsWith('A:') && currentQuestion) {
      const answer = trimmedLine.substring(2).trim();
      qaItems.push({
        title: currentQuestion,
        text: answer,
      });
      currentQuestion = '';
    }
  }

  return qaItems;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
    if (!RETELL_API_KEY) {
      throw new Error('RETELL_API_KEY is not configured');
    }

    const { restaurantId, kbContent } = await req.json();
    if (!restaurantId) {
      throw new Error('restaurantId is required');
    }
    if (!kbContent) {
      throw new Error('kbContent is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, retell_knowledge_base_id')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Parse Q&A content
    const qaItems = parseQAContent(kbContent);
    console.log(`Parsed ${qaItems.length} Q&A items`);

    if (qaItems.length === 0) {
      throw new Error('No Q&A items could be parsed from the content');
    }

    // If restaurant already has a knowledge base, delete it first
    if (restaurant.retell_knowledge_base_id) {
      console.log('Deleting existing knowledge base:', restaurant.retell_knowledge_base_id);
      const deleteResponse = await fetch(
        `https://api.retellai.com/delete-knowledge-base/${restaurant.retell_knowledge_base_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${RETELL_API_KEY}`,
          },
        }
      );
      if (!deleteResponse.ok) {
        console.warn('Failed to delete old KB, continuing anyway:', await deleteResponse.text());
      }
    }

    // Create new knowledge base using multipart/form-data
    const formData = new FormData();
    formData.append('knowledge_base_name', `${restaurant.name} FAQ KB`);
    formData.append('knowledge_base_texts', JSON.stringify(qaItems));

    console.log('Creating knowledge base with', qaItems.length, 'items');

    const kbResponse = await fetch('https://api.retellai.com/create-knowledge-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
      },
      body: formData,
    });

    if (!kbResponse.ok) {
      const errorText = await kbResponse.text();
      console.error('Retell KB creation error:', kbResponse.status, errorText);
      throw new Error(`Failed to create knowledge base: ${errorText}`);
    }

    const kbData = await kbResponse.json();
    const knowledgeBaseId = kbData.knowledge_base_id;

    console.log('Knowledge base created:', knowledgeBaseId);

    // Save to restaurant
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        retell_knowledge_base_id: knowledgeBaseId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId);

    if (updateError) {
      console.error('Error updating restaurant:', updateError);
      throw new Error('Failed to save knowledge base ID');
    }

    return new Response(
      JSON.stringify({
        success: true,
        knowledgeBaseId,
        itemCount: qaItems.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in retell-knowledge-base:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
