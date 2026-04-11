

# Align Shared View + Add YoY Change Indicators to KPIs

## Part 1: Fix Shared View Data Mismatch
*(Carried over from previous approved plan)*

### Edge Function (`supabase/functions/get-shared-view/index.ts`)
- Fetch owner's `residence_country` from profiles table (fallback `AT`)
- Compute dashboard-equivalent metrics: `netLiquidationValue`, `netGain`, `totalDividendsNet`, `topPerformer`, `safeWithdrawalTotal`, `availableProfitTotal` using the same tax formulas
- Return these alongside existing fields

### Shared Page (`src/pages/SharedView.tsx`)
- Replace the 4-card gross summary with the same 2-card KPI layout used in the dashboard (Primary: Net Liquidation, Net Gain/Loss, Net Dividends; Secondary: Top Performer, 4% Withdrawal, Available Profit)
- Use shared formatters from `src/lib/formatters.ts`
- Respect `show_values` toggle for privacy

## Part 2: Year-over-Year Change Indicators (NEW)

### Concept
Each primary KPI shows a small badge with an up/down arrow and percentage change compared to the portfolio value exactly 1 year ago. Example: Net Liquidation shows `↑ 12.3%` in green or `↓ 5.1%` in red.

### Data Source
Query `portfolio_snapshots` for snapshots closest to `today - 365 days` for each portfolio. Compare:
- **Net Liquidation YoY**: current net liquidation vs. 1-year-ago total value minus capital gains tax at that time
- **Gain/Loss YoY**: current net gain vs. 1-year-ago net gain (absolute change)
- **Dividends YoY**: current annual dividends vs. 1-year-ago annual dividends

### Implementation

#### Dashboard (`src/pages/Dashboard.tsx`)
- In `loadInitialData`, also fetch one snapshot per portfolio closest to `snapshot_date ≤ (today - 1 year)`, ordered descending, limit 1
- Compute `previousTotalValue` from those snapshots
- Pass `previousStats` (or individual YoY deltas) to `PortfolioOverview`

#### PortfolioOverview (`src/components/PortfolioOverview.tsx`)
- Accept optional `previousStats?: { totalValue: number; netGain: number; totalDividends: number }` prop
- For each primary KPI, if `previousStats` is available, render a small inline badge:
  ```text
  ┌─────────────────────────────┐
  │ 💰 Net Liquidation          │
  │    36.313,92 €  ↑ 8.2%     │
  │    No tax on losses         │
  └─────────────────────────────┘
  ```
- Use `TrendingUp` / `TrendingDown` icons from lucide-react, colored green/red, with `text-[10px]` sizing

#### Shared View
- The edge function also fetches 1-year-ago snapshots and computes the same deltas
- SharedView displays them identically

### Edge cases
- If no snapshot exists from ~1 year ago, don't show the YoY badge (graceful fallback)
- For new portfolios (< 1 year old), no indicator shown

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/get-shared-view/index.ts` | Add owner tax residence lookup, compute net KPIs, fetch 1yr-ago snapshots for YoY |
| `src/pages/SharedView.tsx` | Replace gross summary with dashboard KPI layout + YoY badges |
| `src/pages/Dashboard.tsx` | Fetch 1yr-ago snapshots, compute `previousStats`, pass to `PortfolioOverview` |
| `src/components/PortfolioOverview.tsx` | Accept `previousStats` prop, render YoY change badges on primary KPIs |
| `src/i18n/locales/en.json`, `de.json`, `sr.json` | Add translation keys for YoY labels |

