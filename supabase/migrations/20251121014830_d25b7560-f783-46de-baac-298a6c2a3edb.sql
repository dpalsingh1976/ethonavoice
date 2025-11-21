-- Update default currency from INR to USD
ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'USD';

-- Update existing orders to use USD
UPDATE orders SET currency = 'USD' WHERE currency = 'INR';