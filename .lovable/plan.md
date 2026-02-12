

# Fix: 2899.HK Still Showing ~33 in Portfolio

## Root Cause Found

The database investigation reveals the issue clearly:

- `original_price_eur` in the portfolios table: **4.4** (correct)
- Latest snapshots (Feb 7-11): `current_price_eur: ~4.5` (correct, after the currency fix)
- Old snapshots (Jan 6 - Feb 5): `current_price_eur: ~33` (corrupted -- HKD value stored as EUR)

The currency fix deployed earlier is working for **new** data, but **39 old snapshots** still contain the wrong HKD-as-EUR values. These corrupt snapshots cause:
1. The Portfolio Performance chart to show inflated historical values
2. Potentially stale cached data being displayed before a refresh

## Fix Plan

### Step 1: Clean Up Corrupted Historical Snapshots

Run a database migration to fix all old snapshots for `2899.HK` by dividing the stored `current_price_eur` by the approximate HKD/EUR rate (~8.25) to convert from the incorrectly stored HKD values to proper EUR values. Also recalculate `current_value_eur` accordingly.

```sql
-- Fix corrupted snapshots where HKD price was stored as EUR
-- The correct conversion: HKD price / ~8.25 = EUR price
-- We identify corrupt rows as those with current_price_eur > 10 (real EUR price is ~4.5)
UPDATE portfolio_snapshots 
SET 
  current_price_eur = current_price_eur / 8.25,
  current_value_eur = (current_price_eur / 8.25) * 22
WHERE portfolio_id = '63698e6b-eec2-4a28-a6a4-18929778c1ba'
  AND current_price_eur > 10;
```

### Step 2: Clear Price Cache for 2899.HK

Delete the stale price_cache entry so the next refresh fetches fresh data with the correct currency detection:

```sql
DELETE FROM price_cache WHERE symbol = '2899.HK';
```

### Summary

| Action | Details |
|--------|---------|
| Fix ~39 old snapshots | Divide HKD values by ~8.25 to get correct EUR |
| Clear price cache | Force fresh fetch with currency detection |
| No code changes needed | The edge function fix is already deployed and working |

After this fix, refreshing the portfolio will show correct EUR values for 2899.HK in both the current display and historical charts.

