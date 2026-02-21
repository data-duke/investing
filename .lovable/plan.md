

# Add Monthly Dividend Income Bar Chart

## Overview

Add a bar chart showing expected dividend income by month for the current year, placed inside the existing `DividendCalendar` collapsible section — right above the event list. The chart uses data already available in the component (`dividendEvents`), so no new API calls or database changes are needed.

## Implementation

### New Component: `src/components/DividendMonthlyChart.tsx`

A bar chart using `recharts` (already installed) that:
- Takes the full `dividendEvents` array and `privacyMode` as props
- Builds a 12-month array (Jan–Dec of the current year) with total expected dividend income per month
- Uses `paymentDate` (falls back to `exDate`) for month assignment
- Renders a `BarChart` with green-colored bars and month labels on the X-axis
- Shows EUR amounts on Y-axis (hidden in privacy mode)
- Custom tooltip showing the month name and formatted EUR amount
- Highlights the current month bar with a slightly different shade
- Compact height (~180px) so it doesn't dominate the calendar section

### Modify: `src/components/DividendCalendar.tsx`

- Import and render `DividendMonthlyChart` inside `CollapsibleContent`, between the upcoming/past toggle buttons and the event list
- Pass `dividendEvents` (all events, not filtered) and `privacyMode` as props
- The chart always shows the full year view regardless of the upcoming/past toggle

### Translation Updates

Add keys to `en.json`, `de.json`, `sr.json`:
- `dividend.monthlyIncome`: "Monthly Dividend Income"
- `dividend.noIncome`: "No income"

## Technical Details

### Chart Data Structure
```text
[
  { month: "Jan", amount: 0 },
  { month: "Feb", amount: 19.58 },   // e.g. CAT payout
  { month: "Mar", amount: 45.20 },
  ...12 months
]
```

### Component Hierarchy
```text
DividendCalendar (existing)
  +-- Collapsible
       +-- Toggle buttons (upcoming/past)
       +-- DividendMonthlyChart (NEW)  <-- all events, full year
       +-- Event list (filtered by toggle)
```

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/DividendMonthlyChart.tsx` | New: bar chart component |
| `src/components/DividendCalendar.tsx` | Import and render the chart |
| `src/i18n/locales/en.json` | Add translation keys |
| `src/i18n/locales/de.json` | Add German translations |
| `src/i18n/locales/sr.json` | Add Serbian translations |

No database changes or new API calls required — the chart uses the existing `dividendEvents` data.

