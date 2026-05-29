## What's actually happening

Looking at the edge-function logs and the `price_cache` table, prices haven't been refreshed since **2026-05-10** (~14 days ago) for most of your symbols. The refresh **is** running, but every call returns the same stale cache. Three concrete bugs are causing that:

### Bug 1 — Early stale-cache return short-circuits the provider chain (main culprit)

In `supabase/functions/fetch-stock-data/index.ts` around line 824:

```text
try FMP   → 403 ❌
try Stooq → "no price found" ❌
                 ↓
        return STALE cache  ← we bail out here
                 ↓
try Yahoo, try Alpha Vantage  ← NEVER REACHED
```

The intent of that early return was "if Stooq has nothing fresh, don't keep the user waiting." In practice it means whenever the first two providers fail (which is exactly what's happening for AGNC, BRK.B, IDUS, IBM, MSFT, MA, LLY, MAIN…) we serve a 14-day-old cached number instead of trying Yahoo / Alpha Vantage. The logs literally show `⚠ Returning STALE cached price for AGNC (21009 min old)` with no Yahoo attempt afterwards.

**Fix:** remove that mid-chain stale return. Stale cache should only be returned at the very end, after every live provider has been tried.

### Bug 2 — FMP is returning 403 for every call

Logs: `FMP fetch failed: External API request failed with status 403`. 403 means the FMP key is being rejected — most commonly because the free-tier daily/monthly quota is exhausted, or the key has been rotated/expired. This is why FMP can't refresh anything.

**Fix on our side:** keep treating 403 as a provider failure and move on (already correct after Bug 1 is fixed). **You may need to refresh the `FMP_API_KEY` secret** — but that's optional; with the chain fixed, Yahoo / Alpha Vantage / Stooq will cover the gap.

### Bug 3 — Per-provider timeout is too tight

`PROVIDER_TIMEOUT_MS = 1500` in the same file. Yahoo's first hit from a cold edge function frequently exceeds 1.5s; we end up timing out and falling back. The previous value (2500ms) was a reasonable balance.

**Fix:** raise `PROVIDER_TIMEOUT_MS` to **2500ms**, keep `ENRICHMENT_TIMEOUT_MS` at 2500ms.

## Changes

1. `supabase/functions/fetch-stock-data/index.ts`
   - Delete the early stale-cache return (lines ~824–828). The final fallback at lines ~864–869 already returns stale cache if everything fails.
   - Raise `PROVIDER_TIMEOUT_MS` from 1500 to 2500.
   - Add a one-line log after the full chain runs, e.g. `Provider chain for SYMBOL: tried [FMP, Stooq, Yahoo, AV] → source=Yahoo`, so future diagnosis is trivial.

2. Deploy `fetch-stock-data` and verify with curl for AGNC, BRK.B, MSFT that the response now has a fresh `source` (Yahoo / Stooq / AV) and `stale: false`.

3. Then check `price_cache.cached_at` in the DB — they should jump to "today" for refreshed symbols, and the dashboard's price-source badges should flip from "Stale" to a fresh provider name.

## Out of scope
- No client-side or UI changes — the freshness badge you just shipped will start reflecting fresh data once the chain is fixed.
- No schema changes.
- Optional follow-up if FMP keeps 403'ing: rotate `FMP_API_KEY`. Tell me if you want me to prompt for a new value.
