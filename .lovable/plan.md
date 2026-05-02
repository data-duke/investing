# Fix: BRK.B Position Shows No Price on Dashboard

## Root cause (confirmed from edge logs)

`fetch-stock-data` for `BRK.B` returns no price. Live fetches:

- **FMP**: HTTP 403 (API key/plan rejected)
- **Stooq**: tried `brk.b`, `brk.b.us`, `brk-b`, `brk-b.us` → all returned "No valid price found"
- **Yahoo**: scrape failed (HTML structure / bot block)

There is a 45h-old cache entry (€404.78) but the code marks it expired and refuses to use it as fallback.

So the position renders without `current_price_eur`, breaking value, gain/loss and KPIs for that holding.

## Fix (3 layers, in `supabase/functions/fetch-stock-data/index.ts`)

### 1. Make Stooq actually parse `brk-b.us`
The Stooq CSV endpoint (`stooq.com/q/l/?s=brk-b.us&f=sd2t2ohlcv&h&e=csv`) does return data for BRK-B; current code likely rejects rows where `Open/High/Low` are `N/D` but `Close` is valid. Loosen the validator to accept a row when `Close` is a positive number, regardless of OHLC nulls.

### 2. Add Alpha Vantage as a real fallback in the chain
`ALPHA_VANTAGE_API_KEY` is already configured. Add a `GLOBAL_QUOTE` call (`function=GLOBAL_QUOTE&symbol=BRK.B`) after Yahoo fails. Alpha Vantage handles dotted US tickers natively.

### 3. Stale-cache safety net
If FMP + Stooq + Yahoo + Alpha Vantage all fail AND a `price_cache` row exists (even if older than 15 min TTL), return that cached price with a flag `stale: true` instead of throwing. Better to show yesterday's price than a blank position.

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/fetch-stock-data/index.ts` | Loosen Stooq row validator; add Alpha Vantage `GLOBAL_QUOTE` fallback step; fall back to expired cache when all live providers fail |

No DB migration, no frontend change, no new secret needed.

## Verification

After deploy:
1. Call `fetch-stock-data` with `symbol=BRK.B` via curl → expect a non-zero `current_price_eur` and a fresh `price_cache` row.
2. Reload the dashboard → BRK.B shows market value, gain/loss, and contributes to KPIs.
3. Check `fetch-stock-data` logs: should show either `Stooq:` success or `AlphaVantage:` success for BRK.B.
