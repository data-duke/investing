-- Add source_currency column to price_cache for proper multi-currency conversion
ALTER TABLE price_cache ADD COLUMN IF NOT EXISTS source_currency TEXT DEFAULT 'USD';