

# Mobile-Optimized KPI Layout Redesign

## Problem
On iPhone 16 (393px), the 3-column grids cause:
- All labels truncated ("Neto likvidaci...", "Neto dobit...", "4% Sigu...")
- Secondary stats are unreadable with icon + label + value crammed together
- Text overflows and wraps awkwardly

## Solution: Responsive Grid with Mobile Stacking

### Primary Stats Card
- **Mobile** (`< md`): Stack as 1 column with 3 horizontal rows, each showing icon + full label on left, value + subtitle on right. Divided by `divide-y`.
- **Desktop** (`md+`): Keep current 3-column side-by-side layout with `divide-x`.

### Secondary Stats Card
- **Mobile**: Same 1-column stacked rows — icon + label left, value right. Compact single-line per metric.
- **Desktop**: Keep current 3-column inline layout.

### Visual approach on mobile
```text
┌──────────────────────────────┐
│ 💰 Net Liquidation           │
│    36.313,92 €               │
│    No tax on losses          │
├──────────────────────────────┤
│ 📈 Net Gain/Loss             │
│    -261,82 €                 │
│    -0.72% · Invested: 36.5k  │
├──────────────────────────────┤
│ 🐷 Annual Dividends          │
│    1.313,76 €                │
│    109,48 €/month avg        │
└──────────────────────────────┘

┌──────────────────────────────┐
│ 🏆 Top Performer    CAT +47% │
├──────────────────────────────┤
│ %  4% Withdrawal   441,77€/yr│
├──────────────────────────────┤
│ ↑  Available Profit 1.658€   │
└──────────────────────────────┘
```

Labels are fully visible. Values have room to breathe. On desktop (md+), it stays compact as the current 3-column layout.

## File to Modify

| File | Change |
|------|--------|
| `src/components/PortfolioOverview.tsx` | Add responsive classes: `grid-cols-1 md:grid-cols-3`, switch dividers `divide-y md:divide-y-0 md:divide-x`, adjust padding per breakpoint |

No logic changes — purely CSS/layout restructuring.

