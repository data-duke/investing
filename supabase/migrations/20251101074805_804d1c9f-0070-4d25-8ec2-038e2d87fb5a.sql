-- Add new columns to portfolios table for enhanced functionality

-- Manual dividend override
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS manual_dividend_eur numeric;

-- Track when dividend was last fetched from API
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS dividend_last_fetched timestamp with time zone;

-- Store exchange suffix for ETFs/commodities (e.g., .L, .DE)
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS exchange_suffix text;

-- User-defined tag for grouping investments
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS tag text;

-- Auto-generated date tag as fallback
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS auto_tag_date text;

-- Add comments for documentation
COMMENT ON COLUMN public.portfolios.manual_dividend_eur IS 'User-entered dividend override, displayed with special styling';
COMMENT ON COLUMN public.portfolios.dividend_last_fetched IS 'Timestamp of last successful API dividend fetch';
COMMENT ON COLUMN public.portfolios.exchange_suffix IS 'Exchange suffix used for successful symbol lookup (e.g., .L, .DE)';
COMMENT ON COLUMN public.portfolios.tag IS 'User-defined tag for grouping/filtering investments';
COMMENT ON COLUMN public.portfolios.auto_tag_date IS 'Auto-generated date tag in YYYY-MM-DD format if no user tag provided';