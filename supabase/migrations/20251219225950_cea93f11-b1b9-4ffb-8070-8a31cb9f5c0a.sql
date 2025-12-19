-- Add webhook_url column to restaurants table for multi-tenant webhook support
ALTER TABLE public.restaurants 
ADD COLUMN webhook_url text;