-- Create dividend_history table to track historical dividend data per stock
CREATE TABLE IF NOT EXISTS public.dividend_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  year INTEGER NOT NULL,
  annual_dividend_usd DECIMAL(10,4) NOT NULL,
  dividend_growth_yoy DECIMAL(6,4), -- Year-over-year growth rate
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, year)
);

-- Create index for efficient lookups
CREATE INDEX idx_dividend_history_symbol ON public.dividend_history(symbol);

-- Enable RLS
ALTER TABLE public.dividend_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access (dividend data is not sensitive)
CREATE POLICY "Allow public read access" 
ON public.dividend_history 
FOR SELECT 
USING (true);

-- Add dividend growth columns to price_cache table
ALTER TABLE public.price_cache 
ADD COLUMN IF NOT EXISTS dividend_growth_1y DECIMAL(6,4),
ADD COLUMN IF NOT EXISTS dividend_growth_3y DECIMAL(6,4),
ADD COLUMN IF NOT EXISTS dividend_growth_5y DECIMAL(6,4);