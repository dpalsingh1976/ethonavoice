-- Add knowledge base ID column to restaurants table
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS retell_knowledge_base_id TEXT;