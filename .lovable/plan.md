

# Add 2 New KPIs: Safe Withdrawal & Available Profit

## What These KPIs Show

Both KPIs only consider positions that are **net positive after tax** (net liquidation value > original investment).

1. **4% Safe Withdrawal** — 4% of the net value of all profitable positions. This is the amount you could sell annually following the 4% rule while keeping your principal intact.
   - Example: Invested €1,000 → net value €1,200 → 4% × €1,200 = **€48**

2. **Available Profit** — The sum of net gains across all profitable positions. This is the cash you could extract right now by selling only the profit portion.
   - Example: Invested €1,000 → net value €1,200 → **€200** available

## Implementation

### File: `src/components/PortfolioOverview.tsx`

Add per-position net value calculation inside the `useMemo`:

```typescript
// For each position, calculate its individual net value after capital gains tax
let safeWithdrawalTotal = 0;
let availableProfitTotal = 0;

portfolios.forEach(p => {
  const invested = Number(p.original_investment_eur);
  const marketValue = p.current_value_eur || 0;
  const grossGainPos = marketValue - invested;
  
  if (grossGainPos > 0) {
    const taxResult = calculateCapitalGainsTax(grossGainPos, userCountry);
    const netValuePos = marketValue - taxResult.tax; // net liquidation for this position
    
    safeWithdrawalTotal += netValuePos * 0.04;
    availableProfitTotal += netValuePos - invested;
  }
});
```

Add 2 new stat cards (using `Percent` and `ArrowUpFromLine` icons from lucide-react). Update grid to `lg:grid-cols-7` (or keep 5 cols with the 2 extra cards wrapping on a second row — better for mobile).

### Layout Approach

Given 7 cards would be cramped, use a **two-row layout**:
- Row 1 (existing 5 KPIs): `grid-cols-2 lg:grid-cols-5`
- Row 2 (new 2 KPIs): `grid-cols-2` — placed below the main KPIs

This keeps the dashboard clean and groups the "withdrawal" KPIs together.

### Translation Keys (en/de/sr)

- `portfolio.safeWithdrawal`: "4% Safe Withdrawal" / "4% Sichere Entnahme" / "4% Sigurno Povlačenje"
- `portfolio.safeWithdrawalDesc`: "Annual amount from profitable positions" / ...
- `portfolio.availableProfit`: "Available Profit" / "Verfügbarer Gewinn" / "Dostupan Profit"
- `portfolio.availableProfitDesc`: "Net gains you can extract now" / ...

### Files to Modify

| File | Change |
|------|--------|
| `src/components/PortfolioOverview.tsx` | Add per-position net calc, 2 new KPI cards in second row |
| `src/i18n/locales/en.json` | Add 4 translation keys |
| `src/i18n/locales/de.json` | German translations |
| `src/i18n/locales/sr.json` | Serbian translations |

