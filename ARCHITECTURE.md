# Architecture — Investing Lovable

> **The technical story behind the pitch.** This document explains how the app is
> built, why the pieces fit together the way they do, and where to look when you
> add something new.
>
> **Maintainers:** keep this current. Every feature that adds a route, table, edge
> function, external provider, or subscription gate must be reflected here **and**
> in `pitch.md` (see `CLAUDE.md` → *Keeping the pitch and architecture current*).

---

## 1. System overview

Investing Lovable is a single-page web app backed by a serverless data layer.

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                           │
│  Vite · React 18 · TypeScript · Tailwind · shadcn/ui          │
│  react-router · @tanstack/react-query · i18next (EN/DE/SR)     │
└───────────────┬───────────────────────────┬──────────────────┘
                │ supabase-js (auth + data)  │ functions.invoke()
                ▼                            ▼
┌──────────────────────────────┐   ┌────────────────────────────┐
│  Supabase Postgres           │   │  Supabase Edge Functions    │
│  · tables + Row-Level Sec.   │   │  (Deno, 11 functions)       │
│  · auth (users/profiles)     │   │  · market data & news       │
│  · price_cache               │   │  · AI (chat/advisor/insight)│
│  · portfolios / investments  │   │  · Stripe billing           │
│  · share tokens              │   │  · shared-view resolver     │
└──────────────────────────────┘   └───────────────┬────────────┘
                                                    │ HTTPS
                     ┌──────────────────────────────┼─────────────────┐
                     ▼                ▼              ▼                  ▼
                  Market data     News API      LLM provider        Stripe
              (FMP · Stooq ·                    (AI features)      (checkout,
             Yahoo · AlphaV.)                                       portal)
```

**Design principle:** the browser never talks to third-party APIs or holds secret
keys directly. All external calls (market data, news, AI, Stripe) go through edge
functions, which hold secrets and enforce auth/entitlement server-side.

---

## 2. Frontend

**Stack:** Vite + React 18 + TypeScript, Tailwind CSS with the shadcn/ui
(Radix-based) component library, React Router for routing, TanStack Query for
server-state, `next-themes` for theming, and i18next for localization.

### Routes (`src/App.tsx`)

| Path | Page | Access |
|---|---|---|
| `/` | `Index` — landing + free AI calculator orb | Public |
| `/login`, `/signup` | Auth | Public |
| `/dashboard` | Full portfolio workspace | Protected (`ProtectedRoute`) |
| `/share/:token` | Read-only shared portfolio | Public (token-gated) |
| `*` | `NotFound` | — |

### Key state & logic

- **`src/hooks/`** — `useAuth` (Supabase session), `usePortfolio` (holdings CRUD +
  fetch), `useSubscription` (entitlement, retries with backoff),
  `useCalculatorChat` (free chat calculator), `useStockNews`.
- **`src/contexts/PrivacyContext.tsx`** — global "blur all values" privacy mode.
- **`src/services/stockApi.ts`** — client wrapper over the market-data edge
  functions.
- **`src/lib/`** — `taxCalculations` (residence-aware tax math), `formatters`,
  `constants` (refresh interval, concurrency caps), `utils`.
- **`src/integrations/supabase/`** — generated client + DB types.

### Notable components

`CalculatorChatOrb` (free wedge), `PortfolioOverview`, `SortableHoldingsTable`,
`DividendCalendar` / `DividendMonthlyChart`, `AllocationChart` /
`ProjectedAllocationChart`, `PortfolioChart`, `AIAdvisorPanel` / `StockAIInsight`,
`PriceSourceBadge` (data-freshness indicator), `ShareDialog` / `ManageSharesDialog`,
`TaxSettingsDialog`, `UpgradeDialog` / `FeatureComparisonBanner` (paywall surface).

---

## 3. Backend — Supabase

### Database

Postgres with **Row-Level Security** as the primary authorization boundary — every
user-owned table is scoped so a user can only read/write their own rows. Notable
tables: `profiles` (incl. `residence_country` for tax), portfolios & investments,
`price_cache` (shared price cache with freshness timestamps), and share tokens for
public read-only views. Schema evolves via timestamped migrations in
`supabase/migrations/`.

### Edge functions (`supabase/functions/`)

| Function | Responsibility |
|---|---|
| `fetch-stock-data` | **Core price pipeline.** Multi-provider fetch chain (FMP → Stooq → Yahoo → Alpha Vantage) with caching, timeouts, and graceful fallback to cache only after all live providers fail. |
| `scrape-stock-price` | Fallback price scraping path. |
| `fetch-dividend-calendar` | Dividend schedule/calendar data. |
| `fetch-stock-news` | Recent news per symbol. |
| `calculator-chat` | Powers the free AI chat calculator. |
| `portfolio-ai-advisor` | AI analysis over a full portfolio. |
| `stock-ai-insight` | Per-stock AI insight ("good dividend stock?"). |
| `create-checkout` | Starts a Stripe subscription checkout. |
| `customer-portal` | Opens the Stripe customer portal. |
| `check-subscription` | Server-side entitlement check (source of truth for Premium; supports an `override` product for comps). |
| `get-shared-view` | Resolves a public share token to a read-only portfolio. |

**Why edge functions:** they keep provider keys and Stripe secrets off the client,
centralize the resilience logic (the price pipeline), and let the SPA stay a pure
static bundle.

---

## 4. Cross-cutting concerns

- **Auth & authorization:** Supabase Auth for identity; RLS for data isolation;
  `check-subscription` for feature entitlement. `ProtectedRoute` guards the client.
- **Entitlement gating:** Premium-only behavior (e.g. auto-refresh every
  `REFRESH_INTERVAL_MS`, unlimited holdings, sharing, export) is gated both in the
  UI and server-side.
- **Data freshness & resilience:** `price_cache` + the provider fallback chain +
  `PriceSourceBadge` make stale data visible rather than silently wrong. The
  hardening history is documented in `.lovable/plan.md`.
- **Internationalization:** i18next with locales in `src/i18n/locales/`
  (`en`, `de`, `sr`). Any new user-facing string must be added to all locales.
- **Tax model:** residence-country-aware, handling withholding and capital-gains
  tax including cross-border (stock domicile → investor residence).
- **Billing:** Stripe for checkout + portal; entitlement verified server-side.
- **Privacy:** client-side privacy mode blurs all monetary values on demand.

---

## 5. Where to add things (quick map)

| You're adding… | Touch these |
|---|---|
| A new page/route | `src/pages/`, `src/App.tsx` |
| A new UI feature | `src/components/`, relevant hook in `src/hooks/` |
| A new data source / server logic | `supabase/functions/`, `src/services/` |
| A schema change | new migration in `supabase/migrations/`, regen types |
| A new tax jurisdiction | `src/lib/taxCalculations`, `profiles.residence_country` |
| A Premium gate | `useSubscription`, `check-subscription`, UI gate |
| Any user-facing text | all locales in `src/i18n/locales/` |

---

## 6. Roadmap & open questions ‹keep current›

> Track forward-looking architecture decisions here so the plan stays a plan, not
> just a snapshot.

- Additional tax jurisdictions (each is a discrete, moat-widening unit).
- Report export pipeline (Premium).
- Test coverage strategy (currently no automated test suite in the repo).
- Observability for the edge-function provider chain.
