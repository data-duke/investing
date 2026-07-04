# Investing Lovable — Pitch

> Two audiences, one story. **Part 1** is written for the people who will *use*
> Investing Lovable. **Part 2** is written for the people who might *fund* it.
> Both describe the same product and the same journey — how we set out to make
> real portfolio math feel effortless, and what we built to get there.
>
> **Maintainers:** this document is a living artifact. Every time a feature ships,
> it must be updated (see `CLAUDE.md` → *Keeping the pitch and architecture current*).
> Metrics marked `‹fill in›` are intentionally left as placeholders — replace them
> with real numbers before sharing externally, and never invent figures.

---

# Part 1 — For Customers

## The one-liner

**Know exactly what your investments will really pay you — after dividends, after
taxes, after time — before you ever put money in.**

## The problem we kept running into

Every investor asks the same three questions and almost no tool answers all three
honestly:

1. *"If I buy this, what will it actually pay me?"* — brokers show a yield number,
   not what lands in your account.
2. *"What does the tax office take?"* — dividend withholding and capital-gains tax
   depend on where the company is domiciled **and** where you live. Most tools
   ignore this entirely.
3. *"What does this look like in 5, 10, 20 years?"* — projections are usually
   buried in spreadsheets you have to build yourself.

So we built the tool we wished existed.

## Start free — just ask

You don't sign up to get value. The first thing you meet is a chat box:

> *"Chat with AI to analyze any stock. Just tell me what you want to invest in,
> and I'll calculate everything for you — dividends, taxes, and projections."*

Type a ticker and an amount. In seconds you get a clear, after-tax picture of a
single holding: projected income, growth based on historical CAGR, and the tax
drag specific to your country. **No account required.**

## Grow into a full portfolio

When one stock isn't enough, one click turns the calculator into a complete
portfolio workspace:

- **📊 Live portfolio tracking** — all your holdings in one sortable table, with
  prices that refresh automatically so your numbers are never stale.
- **💸 Dividend intelligence** — a month-by-month dividend calendar, annual income
  (gross *and* net of tax), and 1-year / 5-year dividend-growth history.
- **🌍 Cross-border tax accuracy** — set your tax residence once. We apply the
  right withholding and capital-gains treatment for each holding, including the
  cross-border case (e.g. a US stock held by an Austrian investor).
- **🔮 Projections you can trust** — future-value estimates grounded in historical
  CAGR, with an honest disclaimer that past performance isn't a promise.
- **🤖 An AI analyst on call** — ask "Is this a good dividend stock?" or get a
  read on your whole portfolio. Plain-language insight, backed by your real data.
- **📰 Context that matters** — recent news surfaced right next to each position.
- **🔗 Share, privately or publicly** — send a read-only link to your advisor,
  partner, or an audience — without handing over your login.
- **🕶️ Privacy mode** — blur every number with one tap when you're on a train or
  screen-sharing.
- **🌐 Your language** — fully available in English, German, and Serbian.

## Free vs. Premium

| | Free Calculator | Full Portfolio (Premium) |
|---|---|---|
| Analyze a single stock | ✅ | ✅ |
| After-tax projections | ✅ | ✅ |
| Tax calculations | ✅ | ✅ |
| Track a full portfolio | — | ✅ |
| Auto-refreshing prices | — | ✅ |
| Historical tracking | — | ✅ |
| Shareable portfolio links | — | ✅ |
| Exportable reports | — | ✅ |

## Who it's for

- **Dividend & income investors** who care about *net* yield, not headline yield.
- **Cross-border investors** who are tired of guessing at withholding tax.
- **Long-term planners** who want to see the decade-out picture at a glance.
- **Anyone curious** who wants to model a single idea in 30 seconds, for free.

## The promise

Honest numbers, after tax, in your language, without a spreadsheet.
Start with a question — grow into a portfolio.

---

# Part 2 — For Investors

## Thesis

Retail investing tools optimize for *transacting* (brokers) or for *charting*
(analytics apps). Almost none optimize for the question that actually drives a
buy decision: **"what will this really pay me, after tax, over time?"**
Investing Lovable owns that question. We turn a tax-and-dividend calculation that
normally requires a spreadsheet and cross-border tax knowledge into a single chat
message — then convert that moment of value into a recurring portfolio
subscription.

## The wedge → platform motion

Our growth model is built into the product surface itself:

1. **Wedge (free, no signup):** the AI chat calculator delivers a genuinely
   useful, after-tax single-stock analysis with zero friction. This is the top of
   the funnel and the shareable, viral surface.
2. **Conversion (Premium):** the moment a user has more than one holding — or
   wants prices to stay fresh, history to accumulate, or a portfolio to share —
   they hit a natural, non-artificial paywall. The value gap between "one
   calculation" and "my living portfolio" is the upgrade.
3. **Retention:** auto-refreshing data, accumulating history, dividend calendars,
   and AI advice compound in value the longer a user stays. A portfolio is sticky
   by nature — switching cost rises with every holding added.

## What we've built (the story so far)

We didn't start with a grand platform. We started with one painful calculation
and made it effortless, then let real usage pull us toward a portfolio product.

- **We started with the calculator.** A conversational, AI-driven single-stock
  analyzer that anyone can use without an account. It proved the core insight:
  people want *net, after-tax, forward-looking* numbers, not raw quotes.
- **We solved the hard, unglamorous problem: tax.** We built a residence-aware
  tax engine that models withholding and capital-gains tax per holding, including
  cross-border cases. This is our moat — it's tedious, jurisdiction-specific, and
  most competitors simply skip it.
- **We made market data reliable.** Free market-data APIs are flaky. We built a
  multi-provider fetch chain (FMP → Stooq → Yahoo → Alpha Vantage) with caching,
  graceful fallback, and per-source freshness badges so the app degrades
  gracefully instead of breaking. (This resilience is real: see the incident
  write-up in `.lovable/plan.md` for how we hardened the provider chain.)
- **We layered on AI where it compounds trust.** An AI portfolio advisor and
  per-stock insights turn raw data into plain-language guidance — the feature that
  makes a spreadsheet feel like a co-pilot.
- **We built the growth loop into the product.** Public share links make every
  serious user a distribution channel, and privacy mode makes sharing safe.
- **We went multi-market from early on.** Full localization in English, German,
  and Serbian, with a tax model designed around residence country — positioning us
  for European cross-border investors, an underserved segment.
- **We shipped a real billing spine.** Stripe-backed subscriptions with checkout,
  a customer portal, and server-side entitlement checks — plus an override path
  for comps and partnerships.

## Why now

- Retail investing participation has structurally stepped up, and dividend/income
  strategies are back in focus in a higher-rate environment.
- LLMs make conversational financial analysis genuinely good for the first time —
  the free wedge wasn't buildable at this quality two years ago.
- Cross-border retail investing (especially in Europe) is growing faster than the
  tools that serve its tax complexity.

## Business model

- **Freemium SaaS.** Free AI calculator (acquisition) → Premium portfolio
  subscription (monetization), billed through Stripe.
- **Expansion paths:** additional jurisdictions (each new country's tax model is a
  moat-widening unit of work), exportable/pro reporting tiers, and advisor/B2B2C
  sharing use cases already latent in the share-link feature.

## Moat

1. **Tax correctness across jurisdictions** — hard to build, tedious to maintain,
   and exactly what users can't get elsewhere.
2. **Data resilience** — a hardened multi-provider pipeline that keeps working
   when any single free API fails.
3. **Product-led distribution** — sharing and the free calculator are built-in
   acquisition channels, not bolt-ons.
4. **Compounding data** — portfolios and history get stickier over time.

## Traction & metrics ‹fill in before sharing›

> Replace every placeholder below with verified numbers. Do not fabricate.

- Registered users: ‹fill in›
- Free calculator sessions / month: ‹fill in›
- Free → Premium conversion rate: ‹fill in›
- MRR / ARR: ‹fill in›
- Retention (M1 / M3): ‹fill in›
- Share-link virality (invites per active user): ‹fill in›

## The ask ‹fill in›

- Raising: ‹fill in› to fund ‹fill in — e.g. jurisdiction expansion, growth,
  team›.
- Use of funds: ‹fill in›.

## Tech at a glance

Modern, low-overhead stack that let a small team ship fast: React + TypeScript +
Vite + Tailwind/shadcn on the front end; Supabase (Postgres, row-level security,
and 11 serverless edge functions) on the back end; Stripe for billing. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full technical story.
