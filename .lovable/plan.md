

# Fix: Shared View Data Mismatch

## Root Cause

Two differences between the owner's Dashboard and the `get-shared-view` edge function cause the shared portfolio to show different numbers:

### 1. Manual dividends ignored
- **Dashboard** (line 134): `portfolio.manual_dividend_eur ?? snap.dividend_annual_eur`
- **Edge function** (line 119): `snap.dividend_annual_eur || 0`
- If the owner set a manual dividend override, the shared view ignores it.

### 2. Dividend aggregation formula differs
- **Dashboard** (lines 193-202): When aggregating by symbol, it checks `manual_dividend_eur` and multiplies it by quantity (`manual_dividend_eur * quantity`), treating it as a per-share value.
- **Edge function** (lines 127-145): Just sums `dividend_annual_eur` from the snapshot — no manual override, no per-share multiplication.

## Fix

Update `supabase/functions/get-shared-view/index.ts` to mirror the Dashboard logic:

### Enrichment step (around line 105-119)
```typescript
// Use manual dividend override if set, same as dashboard
const dividend = portfolio.manual_dividend_eur != null
  ? portfolio.manual_dividend_eur
  : Number(snap.dividend_annual_eur);
return {
  ...portfolio,
  // ...existing fields...
  dividend_annual_eur: dividend,
};
```

And in the fallback (no snapshot):
```typescript
dividend_annual_eur: portfolio.manual_dividend_eur ?? 0,
```

### Aggregation step (around lines 127-160)
Mirror the Dashboard's dividend aggregation:
```typescript
const dividend = p.manual_dividend_eur != null
  ? p.manual_dividend_eur * Number(p.quantity)
  : p.dividend_annual_eur ?? 0;
```

Apply this both for initial grouping and for the `existing` accumulation branch.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/get-shared-view/index.ts` | Apply manual dividend override in enrichment + aggregation steps |

No database or frontend changes needed — the edge function simply needs to match the Dashboard's existing logic.

