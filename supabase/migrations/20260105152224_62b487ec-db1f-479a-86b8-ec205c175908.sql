-- Phase 2: Multiple Tags per Stock
-- Add tags array column
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Migrate existing data from tag column to tags array
UPDATE portfolios SET tags = ARRAY[tag] WHERE tag IS NOT NULL AND tag != '' AND (tags IS NULL OR tags = '{}');

-- Also migrate auto_tag_date if no custom tag
UPDATE portfolios SET tags = ARRAY[auto_tag_date] WHERE auto_tag_date IS NOT NULL AND auto_tag_date != '' AND (tags IS NULL OR tags = '{}');

-- Phase 3: Anonymous Shareable Links
CREATE TABLE IF NOT EXISTS shared_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  user_id UUID NOT NULL,
  tags TEXT[] NOT NULL,
  name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  show_values BOOLEAN DEFAULT true
);

-- Enable RLS on shared_views
ALTER TABLE shared_views ENABLE ROW LEVEL SECURITY;

-- Users can manage their own shares
CREATE POLICY "Users can view own shares" ON shared_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shares" ON shared_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shares" ON shared_views FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shares" ON shared_views FOR DELETE USING (auth.uid() = user_id);

-- Phase 4: Price Cache Table
CREATE TABLE IF NOT EXISTS price_cache (
  symbol TEXT PRIMARY KEY,
  current_price_eur NUMERIC NOT NULL,
  current_price_usd NUMERIC NOT NULL,
  dividend_usd NUMERIC DEFAULT 0,
  name TEXT,
  exchange_rate NUMERIC,
  source TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- No user access to price_cache - only edge functions with service role
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

-- Create index for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_price_cache_cached_at ON price_cache(cached_at);

-- Create index for shared views token lookup
CREATE INDEX IF NOT EXISTS idx_shared_views_token ON shared_views(token);
CREATE INDEX IF NOT EXISTS idx_shared_views_user ON shared_views(user_id);