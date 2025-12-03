-- Add conversation flow ID column to restaurants table
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS retell_conversation_flow_id TEXT;