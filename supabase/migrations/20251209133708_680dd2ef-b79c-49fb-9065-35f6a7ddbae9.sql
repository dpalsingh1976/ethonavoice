-- Add ticket_printed_at column to orders table
ALTER TABLE orders 
ADD COLUMN ticket_printed_at timestamp with time zone DEFAULT NULL;