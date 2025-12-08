-- Add column for multiple agent IDs
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS retell_agent_ids jsonb DEFAULT '[]'::jsonb;

-- Update Honest Restaurant with both agent IDs
UPDATE restaurants 
SET retell_agent_ids = '["agent_4a67154b70b8b788d9b6418434", "agent_2a0748451c26e86f9d1ae3933d"]'::jsonb
WHERE id = '8812c912-41c3-4b01-8760-f12bbcfa0c0d';