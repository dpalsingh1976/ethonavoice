-- Enable REPLICA IDENTITY FULL for complete row data in realtime
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;