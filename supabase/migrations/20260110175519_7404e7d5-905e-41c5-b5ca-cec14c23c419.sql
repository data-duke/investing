-- First, delete duplicate snapshots keeping only the latest per portfolio per day
DELETE FROM portfolio_snapshots ps1
WHERE EXISTS (
  SELECT 1 FROM portfolio_snapshots ps2
  WHERE ps2.portfolio_id = ps1.portfolio_id
    AND DATE(ps2.snapshot_date AT TIME ZONE 'UTC') = DATE(ps1.snapshot_date AT TIME ZONE 'UTC')
    AND ps2.snapshot_date > ps1.snapshot_date
);

-- Create unique index to prevent future duplicates (one snapshot per portfolio per day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_snapshots_daily 
ON portfolio_snapshots (portfolio_id, (DATE(snapshot_date AT TIME ZONE 'UTC')));

-- Add RLS policy for price_cache to allow public read access
-- (This table is used by edge functions via service role, but we add read access for safety)
CREATE POLICY "Allow public read access" ON price_cache
FOR SELECT USING (true);