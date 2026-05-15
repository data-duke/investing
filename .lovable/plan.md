# Fix Prices Not Loading

## Problem
Prices are failing because the refresh flow starts several `fetch-stock-data` calls at once, each function then performs multiple slow external provider calls and extra enrichment (dividend/CAGR/growth). The latest direct test for `BRK.B` timed out before the function reached the stale-cache fallback.

## Plan

### 1. Make `fetch-stock-data` return a price quickly
- Check stale `price_cache` immediately after the fresh-cache check.
- If live providers cannot return a price quickly, return the last cached price instead of waiting through every slow enrichment step.
- Add per-provider request timeouts so one provider cannot block the whole function.

### 2. Prevent dashboard refresh overload
- Lower dashboard price refresh concurrency from 5 to a safer value, likely 2.
- Keep deduplication by symbol so duplicate lots still only fetch once.

### 3. Skip slow enrichment when using fallback data
- If returning stale cache, do not run dividend/CAGR/growth calls.
- Keep existing cached dividend/CAGR fields where available.

### 4. Verify the fix
- Deploy `fetch-stock-data`.
- Test `BRK.B` and a normal ticker through the live function.
- Confirm dashboard refresh receives non-zero prices instead of blank values.

## Files to change
- `supabase/functions/fetch-stock-data/index.ts`
- `src/lib/constants.ts`