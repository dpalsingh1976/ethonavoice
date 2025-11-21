-- Add system_prompt column to restaurant_voice_settings
ALTER TABLE public.restaurant_voice_settings 
ADD COLUMN system_prompt TEXT;