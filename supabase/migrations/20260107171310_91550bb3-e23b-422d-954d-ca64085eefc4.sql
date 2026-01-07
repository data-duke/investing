-- Add CAGR columns to price_cache table
ALTER TABLE public.price_cache ADD COLUMN IF NOT EXISTS cagr_5y NUMERIC DEFAULT NULL;
ALTER TABLE public.price_cache ADD COLUMN IF NOT EXISTS cagr_calculated_at TIMESTAMPTZ DEFAULT NULL;