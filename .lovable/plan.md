## Goal

Show, for every position on the Dashboard, a small badge next to the current price that indicates:
- whether the price is **fresh** or **stale** (cached fallback)
- **which provider** supplied it (FMP, Stooq, Yahoo, Alpha Vantage, Cache)

This is a UI-only change. The `fetch-stock-data` edge function already returns `source` and (when applicable) `stale` + `staleAgeMinutes`; right now Dashboard drops those fields.

## Changes

### 1. Carry provider/stale metadata through the client
- `src/services/stockApi.ts` — extend `StockData` with `source?: string`, `stale?: boolean`, `staleAgeMinutes?: number`.
- `src/hooks/usePortfolio.tsx` and `src/lib/constants.ts` — add optional, non-persisted fields to `Portfolio` and `AggregatedPosition`: `price_source?`, `price_stale?`, `price_age_minutes?`.
- `src/pages/Dashboard.tsx` — when applying refreshed prices, copy these three fields onto the in-memory `Portfolio` object (no DB schema changes; not stored in snapshots). When a refresh fails and we fall back to the latest snapshot, set `price_source = 'snapshot'` and `price_stale = true`.

### 2. New small UI component
- `src/components/PriceSourceBadge.tsx` — renders a compact badge:
  - Fresh → subtle `secondary` style, label = provider short name (e.g. "FMP", "Yahoo", "Stooq", "AV").
  - Stale → `outline` style with warning color, label = "Stale".
  - Wrapped in a `Tooltip` showing full provider name and, if stale, the age (e.g. "Cached 2h ago — live providers unavailable").

### 3. Render the badge
- `src/components/SortableHoldingsTable.tsx` — next to the current price cell, render `<PriceSourceBadge .../>` when `position.price_source` is set.
- `src/components/HoldingsTable.tsx` — same, next to the current price.
- `src/components/MobileStockDetailsSheet.tsx` — show the badge next to "Current Price" in the Position Summary card.

### 4. i18n
- Add a couple of strings (`portfolio.priceFresh`, `portfolio.priceStale`, `portfolio.priceSourceTooltip`) to `en.json`, `de.json`, `sr.json`.

## Out of scope
- No edge function changes; `fetch-stock-data` already exposes `source`/`stale`.
- No DB/snapshot schema changes — metadata is per-refresh, in-memory only.
- No change to refresh logic, tax math, or aggregation.
