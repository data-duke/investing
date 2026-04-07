

# Redesign KPI Layout + Calculation Reference

## Current Problem
- 7 separate cards across 3 visual rows on mobile (2+2+1+2)
- "Top Performer" sits alone on its own row
- Bottom 2 cards feel disconnected from the rest
- Too much vertical space consumed before the user reaches their holdings

## Proposed Layout: Compact Two-Section Design

### Section 1: Primary Stats (single card with internal grid)
One card containing the 3 core financial metrics in a compact row layout:

```text
┌─────────────────────────────────────────┐
│  Net Liquidation    Gain/Loss   Divid.  │
│  €36,313.92        -€261.82    €1,313   │
│  Invested: €36,575  -0.72%     €109/mo  │
└─────────────────────────────────────────┘
```

On mobile (393px), this becomes a 3-column mini-grid inside one card. Each metric is a compact block — title, value, subtitle — no card borders between them, just subtle dividers.

### Section 2: Secondary Stats (horizontal strip)
A slim horizontal strip with 3 items inline: Top Performer, 4% Withdrawal, Available Profit.

```text
┌──────────────┬──────────────┬──────────────┐
│ 🏆 CAT       │ 4% Rule      │ Avail Profit │
│ +47.92%      │ €441.77/yr   │ €1,658.27    │
└──────────────┴──────────────┴──────────────┘
```

On mobile: 3 equal columns, compact text, no full Card wrapper — just a single card with 3 sections.

### Result
- **Before**: 7 cards, ~4 scroll screens of KPIs
- **After**: 2 cards, ~1.5 scroll screens — clean and scannable

## Calculation Reference (Last 2 KPIs)

Both only consider positions where `grossGain > 0` (market value > invested):

### 4% Safe Withdrawal
```
For each position where marketValue > invested:
  grossGain = marketValue - invested
  tax = calculateCapitalGainsTax(grossGain, country).tax
  netValue = marketValue - tax          // what you'd get if you sold
  withdrawal += netValue * 0.04         // 4% of that

Total = sum of all profitable positions' 4% net values
```
Example: Invested €1,000, market €1,200, tax 27.5% on €200 gain = €55 tax, net = €1,145, 4% = **€45.80**

### Available Profit
```
For each position where marketValue > invested:
  grossGain = marketValue - invested
  tax = calculateCapitalGainsTax(grossGain, country).tax
  netValue = marketValue - tax
  profit += netValue - invested         // extractable cash above principal

Total = sum of all profitable positions' net gains
```
Example: Same position → €1,145 - €1,000 = **€145** available

**Key point**: Both exclude losing positions entirely. A stock down 20% contributes €0 to both KPIs.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PortfolioOverview.tsx` | Replace 7 separate cards with 2 consolidated cards using internal grid layouts |

No calculation logic changes — only UI restructuring.

