
# Regression Testing & Technical Debt Cleanup Plan

## Issues Identified

### 1. Currency Conversion Bug for 2899.HK (Hong Kong Stock)

**Problem:** The stock `2899.HK` is priced in HKD, but the `fetch-stock-data` edge function only converts from USD to EUR. Looking at the price_cache:
- `current_price_usd: 39.56` (this is actually HKD, mislabeled)
- `current_price_eur: 33.34` (incorrectly converted using USD→EUR rate of 0.843)

The Yahoo Finance fallback correctly returns `currency: 'HKD'` but this metadata is ignored in the conversion logic.

**Root Cause:** Lines 732-737 in `fetch-stock-data/index.ts`:
```typescript
const usdToEur = await fetchExchangeRate(); // Only fetches USD→EUR
const currentPrice = currentPriceUSD * usdToEur; // Assumes all prices are USD
```

**Solution:** Detect the source currency from Yahoo/FMP response and convert accordingly:
1. Add HKD, GBP, CAD, CHF exchange rate fetching
2. Store source currency in price_cache
3. Convert from actual currency to EUR

---

### 2. Post-Login Redirect Goes to Index Instead of Dashboard

**Problem:** After login/signup, users are redirected to `/` (calculator) instead of `/dashboard`.

**Files affected:**
- `src/pages/Login.tsx` - Lines 58 and 101: `navigate("/")`
- `src/pages/SignUp.tsx` - Lines 59 and 129: `navigate("/")`

**Solution:** Change redirect to `/dashboard` for authenticated users.

---

### 3. Chart Calculation Verification

**PortfolioChart.tsx:** ✅ Calculations appear correct
- Properly tracks cumulative invested
- Uses snapshot values from database
- Handles pre-existing portfolios before date range

**AllocationChart.tsx:** ✅ Correct
- Uses `current_value_eur` directly for allocation percentages

**ProjectedAllocationChart.tsx:** ✅ Correct
- Uses 5-year CAGR with max cap of 25%
- Properly projects values

---

### 4. Dividend Calculation Verification

**Issue Found:** Mixed dividend handling between net and gross

In `Dashboard.tsx` `refreshPrices()` (lines 321-338):
```typescript
// Calculates NET dividend and stores in snapshot
const taxBreakdown = calculateDividendTax(...)
netDividend = taxBreakdown.netDividend;
```

But in `PortfolioOverview.tsx` (lines 40-50):
```typescript
// Tries to apply tax AGAIN to already-net dividend
if (p.manual_dividend_eur) {
  const taxBreakdown = calculateDividendTax(...)
  return sum + taxBreakdown.netDividend;
}
// This dividend_annual_eur is already net!
return sum + (p.dividend_annual_eur ?? 0);
```

**Problem:** Manual dividends are taxed correctly, but API dividends get double-counted as already net.

**Solution:** Standardize: Store gross dividends in DB, apply tax calculation at display time consistently.

---

### 5. Technical Debt Items

**a) Duplicate AggregatedPosition interface definitions:**
- `src/lib/constants.ts` (lines 49-80) - canonical
- `src/components/SortableHoldingsTable.tsx` (lines 28-41)
- `src/components/MobileStockDetailsSheet.tsx` (lines 18-31)
- `src/components/AllocationChart.tsx` (lines 7-13)
- `src/components/DividendCalendar.tsx` - uses import from constants

**b) Legacy tag fields:**
- Both `tag` (single) and `tags` (array) exist in Portfolio interface
- `auto_tag_date` also exists separately

**c) Missing TypeScript strict null checks:**
- Many `portfolio.quantity` accessed without Number() conversion

---

## Implementation Plan

### Phase 1: Critical Fixes

#### 1.1 Fix Currency Conversion for International Stocks

**File: `supabase/functions/fetch-stock-data/index.ts`**

```text
Changes:
1. Add new function: fetchMultiCurrencyRates()
   - Fetch USD, HKD, GBP, CAD, CHF to EUR rates
   
2. Modify fetchFromYahoo() to return currency
   - Already returns currency, just need to use it

3. Update main handler (lines 650-740):
   - Track source currency from each data source
   - Convert using correct rate based on currency
   - Store source currency in price_cache (add column)
```

**Database Migration:**
```sql
ALTER TABLE price_cache ADD COLUMN IF NOT EXISTS source_currency TEXT DEFAULT 'USD';
```

#### 1.2 Fix Post-Login Redirect

**File: `src/pages/Login.tsx`**
- Line 58: Change `navigate("/")` → `navigate("/dashboard")`
- Line 101: Change `navigate("/")` → `navigate("/dashboard")`

**File: `src/pages/SignUp.tsx`**
- Line 59: Change `navigate("/")` → `navigate("/dashboard")`
- Line 129: Change `navigate("/")` → `navigate("/dashboard")`

### Phase 2: Dividend Calculation Standardization

#### 2.1 Store Gross Dividends Consistently

**File: `src/pages/Dashboard.tsx`**

Modify `refreshPrices()` to store GROSS dividend per share:
```typescript
// Instead of calculating net dividend, store gross
const grossDividendPerShare = stockData.dividend || 0;
const grossDividendTotal = grossDividendPerShare * Number(portfolio.quantity);

snapshotInserts.push({
  ...
  dividend_annual_eur: grossDividendTotal, // GROSS, not net
});
```

#### 2.2 Update PortfolioOverview to Apply Tax Uniformly

**File: `src/components/PortfolioOverview.tsx`**

```typescript
const totalDividends = portfolios.reduce((sum, p) => {
  const grossDividend = p.manual_dividend_eur 
    ? p.manual_dividend_eur * Number(p.quantity)
    : p.dividend_annual_eur ?? 0;
  
  const taxBreakdown = calculateDividendTax(
    grossDividend / Number(p.quantity), // per-share
    Number(p.quantity),
    p.country,
    userCountry
  );
  return sum + taxBreakdown.netDividend;
}, 0);
```

### Phase 3: Technical Debt Cleanup

#### 3.1 Consolidate AggregatedPosition Interface

**Files to update:**
- `src/components/SortableHoldingsTable.tsx` - Remove local interface, import from constants
- `src/components/MobileStockDetailsSheet.tsx` - Remove local interface, import from constants
- `src/components/AllocationChart.tsx` - Remove local interface, import from constants

#### 3.2 Add AggregatedPosition Reexport

**File: `src/lib/constants.ts`**
Already has the canonical definition - just need to update imports.

#### 3.3 Consistent Number Handling

Add eslint rule or convert all `portfolio.quantity` to `Number(portfolio.quantity)` for safety.

---

## Testing Checklist

After implementation:

1. **Currency Conversion**
   - [ ] Refresh 2899.HK and verify price shows in EUR (correctly converted from HKD)
   - [ ] Test US stocks still work (USD→EUR)
   - [ ] Test UK stocks (.L suffix) convert GBP→EUR

2. **Login/Signup Flow**
   - [ ] Login → lands on /dashboard
   - [ ] Signup → lands on /dashboard
   - [ ] Pending investment from calculator → lands on /dashboard with highlight

3. **Dividend Calculations**
   - [ ] Manual dividend shows correct net after tax
   - [ ] API-fetched dividend shows correct net after tax
   - [ ] Portfolio overview annual dividends matches sum of positions

4. **Charts**
   - [ ] Portfolio performance chart shows correct invested vs value
   - [ ] Allocation chart percentages sum to 100%
   - [ ] Projected allocation uses CAGR correctly

5. **Mobile Experience**
   - [ ] Stock details sheet shows Net Value (After Tax) correctly
   - [ ] Holdings cards show net value prominently

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/fetch-stock-data/index.ts` | Multi-currency support, store source currency |
| `src/pages/Login.tsx` | Redirect to /dashboard |
| `src/pages/SignUp.tsx` | Redirect to /dashboard |
| `src/pages/Dashboard.tsx` | Store gross dividends, not net |
| `src/components/PortfolioOverview.tsx` | Apply tax to all dividends uniformly |
| `src/components/SortableHoldingsTable.tsx` | Import AggregatedPosition from constants |
| `src/components/MobileStockDetailsSheet.tsx` | Import AggregatedPosition from constants |
| `src/components/AllocationChart.tsx` | Import AggregatedPosition from constants |

**Database Migration:** Add `source_currency` column to `price_cache`
