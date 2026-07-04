# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this project is

**Investing Lovable** — a freemium, AI-powered investment portfolio tracker.
A free, no-signup AI chat calculator analyzes a single stock (after-tax dividends,
taxes, projections); a Premium tier turns it into a full portfolio workspace with
auto-refreshing prices, dividend intelligence, cross-border tax accuracy, AI
advice, sharing, and reports.

- **Product & business narrative:** [`pitch.md`](./pitch.md) (Part 1 customers,
  Part 2 investors).
- **Technical design:** [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **Incident/change history example:** [`.lovable/plan.md`](./.lovable/plan.md).

## Tech stack

- **Frontend:** Vite · React 18 · TypeScript · Tailwind · shadcn/ui (Radix) ·
  react-router · TanStack Query · i18next (EN/DE/SR).
- **Backend:** Supabase — Postgres with Row-Level Security, Auth, and 11 Deno edge
  functions in `supabase/functions/`.
- **Billing:** Stripe (checkout, customer portal, server-side entitlement).
- Package manager: **bun** (see `bun.lock`); `npm` also works.

## Common commands

```sh
bun install       # or npm i
bun run dev       # local dev server (Vite)
bun run build     # production build
bun run lint      # eslint
```

## Repository map

- `src/pages/` — routed pages (`Index`, `Login`, `SignUp`, `Dashboard`,
  `SharedView`, `NotFound`).
- `src/components/` — feature + `ui/` (shadcn) components.
- `src/hooks/` — `useAuth`, `usePortfolio`, `useSubscription`, `useCalculatorChat`,
  `useStockNews`.
- `src/lib/` — `taxCalculations`, `formatters`, `constants`, `utils`.
- `src/services/stockApi.ts` — client wrapper over market-data edge functions.
- `src/i18n/locales/` — `en.json`, `de.json`, `sr.json`.
- `supabase/functions/` — edge functions; `supabase/migrations/` — schema.

## Conventions

- **Secrets never touch the client.** All third-party calls (market data, news,
  AI, Stripe) go through edge functions.
- **Authorization = RLS + `check-subscription`.** Enforce Premium gating on the
  server, not just the UI.
- **Every user-facing string is localized.** Add new keys to *all* locales
  (`en`, `de`, `sr`) — never hardcode display text.
- **Tax is residence-aware.** Respect `profiles.residence_country` and cross-border
  handling in any money/dividend/tax logic.

---

## ⚠️ Keeping the pitch and architecture current

**This is a required step, not optional.** `pitch.md` and `ARCHITECTURE.md` are
living documents that must stay accurate as the product evolves.

**Whenever you add, remove, or materially change a feature, in the same change you
must update both documents so they never drift from reality:**

1. **`pitch.md`**
   - **Part 1 (Customers):** if the feature is user-visible, add/adjust it in the
     feature list, the Free-vs-Premium table, or the value proposition — written in
     marketing voice.
   - **Part 2 (Investors):** if it affects the story, moat, business model,
     wedge→platform motion, or roadmap, reflect it there too.
   - Keep the narrative in past tense ("we built…") — it tells the story of a
     product that already exists.
   - **Never fabricate metrics.** Leave `‹fill in›` placeholders for real numbers.

2. **`ARCHITECTURE.md`**
   - Update the relevant section: routes table, edge-functions table, database
     tables, external providers, cross-cutting concerns, the "where to add things"
     map, and the roadmap.
   - If you added a route, table, migration, edge function, provider, or Premium
     gate, it **must** appear here.

3. **This `CLAUDE.md`** — update the repository map, conventions, or commands if
   the change affects how future work is done.

**Definition of done for any feature includes:** code + localized strings +
`pitch.md` + `ARCHITECTURE.md` updated. A feature PR that changes product surface
but leaves these docs stale is incomplete.
