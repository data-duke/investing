

# Updated Fix Plan: Currency, Capital Gains Tax, Dividend Calendar, and Top Performer KPI

## Issues to Address

### Issue 1: 2899.HK Shows Incorrect Price (~34 HKD instead of ~4.4 EUR)

**Root Cause:** Stooq returns the price (39.56 HKD) but doesn't provide currency metadata. The code defaults to USD when Stooq is the source.

**Solution:** Add a `detectCurrencyFromSymbol()` helper to infer currency from the stock symbol suffix (`.HK` = HKD, `.L` = GBP, etc.) and use it when Stooq is the data source.

---

### Issue 2: Some Stocks Show "After Tax" When There's No Gain

**Current Behavior:** Stocks with losses show "after tax" label, which is confusing since there's no tax on losses.

**Solution:** Display "no gain" instead of "after tax" for holdings with zero or negative gains.

---

### Issue 3: Dividend Calendar Shows Ex-Date Instead of Payment Date

**Current Behavior:** Calendar groups and displays events by ex-date.

**User Request:** Show payment date first (when you actually receive the money).

**Solution:**
- Group events by payment date (fall back to ex-date if unavailable)
- Display payment date prominently in the date box
- Show ex-date as secondary info
- Mark estimated dates when payment date is unknown

---

### Issue 4: Top Performer KPI Missing (NEW)

**Current Behavior:** The `topPerformer` calculation exists in `PortfolioOverview.tsx` (lines 68-72), the `Award` icon is imported, and translations exist, but the KPI was accidentally removed from the stats array.

**Solution:** Add the Top Performer KPI back to the stats array as the 5th card.

---

## Implementation Details

### Fix 1: Currency Detection for Stooq

**File: `supabase/functions/fetch-stock-data/index.ts`**

Add helper function:
```typescript
function detectCurrencyFromSymbol(symbol: string): CurrencyCode {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('.HK')) return 'HKD';
  if (upper.endsWith('.L')) return 'GBP';
  if (upper.endsWith('.TO') || upper.endsWith('.V')) return 'CAD';
  if (upper.endsWith('.SW') || upper.endsWith('.VX')) return 'CHF';
  if (upper.endsWith('.DE') || upper.endsWith('.F') || upper.endsWith('.MU')) return 'EUR';
  if (upper.endsWith('.PA') || upper.endsWith('.AS') || upper.endsWith('.MI')) return 'EUR';
  return 'USD'; // Default for US stocks
}
```

Update Stooq fallback to use detected currency instead of defaulting to USD.

---

### Fix 2: Improve Capital Gains Tax Messaging

**File: `src/components/SortableHoldingsTable.tsx`**

Update the net value label:
```typescript
<div className="text-xs text-muted-foreground">
  {(position.gain_loss_eur || 0) <= 0 ? 'no gain' : 'after tax'}
</div>
```

---

### Fix 3: Dividend Calendar - Show Payment Date First

**File: `src/components/DividendCalendar.tsx`**

Changes:
1. Group events by `paymentDate` (fall back to `exDate`)
2. Sort events by payment date
3. Display payment date prominently in date box
4. Show "est." label when payment date is unknown
5. Show ex-date as secondary info below event details

---

### Fix 4: Restore Top Performer KPI

**File: `src/components/PortfolioOverview.tsx`**

Add the 5th stat to the array (after annual dividends):

```typescript
{
  title: t('portfolio.topPerformer'),
  value: topPerformer?.symbol || t('portfolio.noData'),
  icon: Award,
  description: topPerformer 
    ? `+${formatPercentage(topPerformer.gain_loss_percent || 0)}` 
    : '',
  className: "text-amber-600",
},
```

Update the grid layout to accommodate 5 cards:
```typescript
<div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
```

---

### Translation Updates

**Files: `src/i18n/locales/en.json`, `de.json`, `sr.json`**

Add new keys:
```json
{
  "dividend": {
    "exDate": "Ex-date",
    "estimated": "est."
  }
}
```

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/fetch-stock-data/index.ts` | Add `detectCurrencyFromSymbol()`, use for Stooq source |
| `src/components/SortableHoldingsTable.tsx` | Show "no gain" for losses instead of "after tax" |
| `src/components/DividendCalendar.tsx` | Show payment date first, ex-date as secondary |
| `src/components/PortfolioOverview.tsx` | Add Top Performer KPI back, update grid to 5 columns |
| `src/i18n/locales/en.json` | Add `dividend.exDate` translation |
| `src/i18n/locales/de.json` | Add German translation |
| `src/i18n/locales/sr.json` | Add Serbian translation |

---

## Testing Checklist

1. **Currency Conversion**
   - Clear cache for `2899.HK` and refresh → should show ~€4.67 (not €33)
   
2. **Capital Gains Tax Labels**
   - Stocks with losses show "no gain"
   - Stocks with gains show "after tax"

3. **Dividend Calendar**
   - Events grouped by payment date
   - Payment date shown prominently
   - Ex-date shown as secondary info

4. **Top Performer KPI**
   - 5th card displays with Award icon
   - Shows stock symbol and gain percentage
   - Amber/gold color styling

