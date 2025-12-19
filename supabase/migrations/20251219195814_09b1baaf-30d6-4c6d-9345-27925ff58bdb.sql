-- Add elevenlabs_agent_id column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN elevenlabs_agent_id text;

-- Add elevenlabs_agent_ids array column for multi-agent support (like retell_agent_ids)
ALTER TABLE public.restaurants 
ADD COLUMN elevenlabs_agent_ids jsonb DEFAULT '[]'::jsonb;