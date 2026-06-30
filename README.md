<div align="center">

<img src="./static/logo.png" alt="Solvo" width="220" />

# Solvo

**Know what your subscriptions actually cost. Cancel the ones that aren't worth it.**

_Solvo_ — Latin: to release, to set free, to pay off.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-fbf0df?logo=bun&logoColor=000)](https://bun.sh)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=fff)](https://svelte.dev)

[Features](#features) · [Getting started](#getting-started) · [How cancel works](#how-cancel-works) · [Tech stack](#tech-stack) · [Contributing](#contributing)

</div>

---

Solvo is a **local-first** subscription manager. It helps you see every recurring charge you're paying for, understand what it actually costs you per day, month, and year, and cancel the ones you no longer want — all without sending a single byte to the cloud.

No accounts. No tracking. No SaaS-to-manage-your-SaaS. Just a SQLite file on your own machine.

## Why Solvo

Subscriptions are designed to be easy to start and easy to forget about. Solvo flips that: it's a deliberately boring, honest ledger that makes the true cost of your subscriptions impossible to ignore, and makes cancelling as low-friction as the cancellation flow lets you get.

## Features

- 📋 **Subscription ledger** — track name, price, currency, billing cycle, next renewal, category, and status in one place.
- 💸 **Honest cost math** — every subscription is normalized to a per-day rate (using average period lengths) and rolled up into per-day / per-month / per-year totals, unit-tested for correctness.
- 🌍 **Dual currency** — store subscriptions in EUR or USD; the dashboard converts everything into your chosen display currency using an editable, offline-friendly exchange rate.
- 📊 **Spending charts** — a 12-month projected spending chart and a category breakdown donut chart, so you can see trends and where your money actually goes.
- 🔥 **Most expensive, at a glance** — the dashboard ranks your priciest active subscriptions so you know exactly where to start if you're cutting costs.
- 🆓 **Trial tracking** — mark a subscription as a free trial with an end date. You'll see how many days are left, and on the end date the trial auto-converts to a paid subscription unless you cancel it first.
- ✅ **Assisted cancel, with a safety net** — one click opens the provider's official cancellation page (or shows stored instructions); you then type a confirmation phrase before Solvo marks it cancelled and drops it from your totals.
- 🔎 **Search, filter, and sort** — full-text search across name/category/notes, status and category filters, and sortable columns (name, monthly cost, next renewal).
- 📱 **Responsive UI** — a proper desktop table and a touch-friendly card layout on mobile, both backed by the same data and actions.
- 🎨 **Themeable** — four built-in color themes, each with a light and dark palette.
- 🔒 **Local & private** — all data lives in a single SQLite file on your machine. Export/import JSON backups any time you like.
- 🧪 **Demo mode** — explore the full app with realistic seed data, without touching your real database.

## How cancel works

There's no universal API for cancelling third-party subscriptions, so Solvo uses an **assisted** approach instead of pretending to do something it can't:

1. Click **Cancel** on a subscription. If it's a known provider, Solvo opens their official cancellation page in a new tab; otherwise it shows any cancellation notes you saved (steps, phone number, email).
2. You go cancel it with the provider, the same way you always would.
3. Back in Solvo, type a short confirmation phrase (e.g. `Netflix cancelled`) to confirm you actually did it.
4. Solvo marks it cancelled locally and stops counting its cost in your totals.

Solvo never stores your provider credentials and never automates logins or payments on your behalf — it just removes the friction of *finding* the right cancellation page and keeps your books honest afterward.

A bundled [registry](./src/lib/registry.ts) of 20+ popular services (Netflix, Spotify, Adobe, GitHub, iCloud, and more) auto-fills the cancellation link and category when you type a recognized name. Unknown services degrade gracefully — you just fill in the details yourself.

## Getting started

### Prerequisites

- [Bun](https://bun.sh) (latest stable release recommended)

### Installation

```bash
git clone git@github.com:SalzDevs/solvo.git
cd solvo
bun install
bun run dev
```

Then open the printed URL (default [http://localhost:5173](http://localhost:5173)).

A SQLite database is created automatically as `solvo.db` in the project root on first run. Set the `SOLVO_DB` environment variable to store it elsewhere.

### Demo mode

Want to explore Solvo with realistic sample data, without touching your real database?

```bash
bun run demo
```

This boots against a throwaway in-memory database seeded with example subscriptions across varied currencies, billing cycles, and renewal dates. Nothing is persisted — restart and you get a clean slate.

### Running tests

The pure cost, renewal, sorting, and filtering logic is unit-tested with `bun test`:

```bash
bun test
```

Type-check the project with:

```bash
bun run check
```

### Production build

```bash
bun run build
bun ./build/index.js
```

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime & package manager | [Bun](https://bun.sh) |
| Framework | [SvelteKit](https://svelte.dev) (Svelte 5, runes) |
| UI components | [shadcn-svelte](https://shadcn-svelte.com) + [Tailwind CSS](https://tailwindcss.com) |
| Storage | [`bun:sqlite`](https://bun.sh/docs/api/sqlite) — a single local file, no server required |
| Deployment adapter | [`svelte-adapter-bun`](https://github.com/gornostay25/svelte-adapter-bun) |

## Project structure

```
src/
├─ lib/
│  ├─ cost.ts                     # pure cost normalization + currency conversion
│  ├─ renewals.ts                 # renewal date math, status badges
│  ├─ subscriptions-filter.ts     # search/status/category filtering
│  ├─ subscriptions-sort.ts       # column sorting logic
│  ├─ trials.ts                   # trial reminder logic
│  ├─ registry.ts                 # known providers -> official cancel URLs
│  ├─ themes.ts                   # color theme registry
│  ├─ types.ts                    # shared domain types
│  ├─ components/charts/          # bar chart + donut chart components
│  └─ server/
│     ├─ db.ts                    # bun:sqlite connection + migrations
│     └─ subscriptions.ts         # CRUD, cancel, settings, export/import
└─ routes/
   ├─ +page.svelte                # dashboard: totals, charts, top spenders, trials
   ├─ subscriptions/              # list, search/filter/sort, add/edit, assisted cancel
   ├─ settings/                   # currency, FX rate, theme, export/import
   └─ api/export/                 # JSON backup download
```

Most of the interesting logic (`cost.ts`, `renewals.ts`, `subscriptions-filter.ts`, `subscriptions-sort.ts`, `trials.ts`) is pure, framework-free TypeScript with accompanying `*.test.ts` files — that's deliberate, so the rules that decide what something costs you are easy to read, test, and trust.

## Roadmap

- [ ] CSV / bank statement import
- [ ] Live exchange-rate refresh
- [ ] Renewal reminders & notifications
- [x] Spending trends and charts — 12-month projection + category donut on the dashboard
- [x] Trial tracking — per-row Trial button + auto-conversion on the end date
- [x] Search, filter, and sort on the subscriptions list
- [x] Responsive mobile layout

## Contributing

Issues and pull requests are welcome. A few guidelines to keep things smooth:

1. Keep domain logic (`src/lib/*.ts`) pure and unit-tested — avoid reaching into Svelte components or the database from these files.
2. Run `bun test` and `bun run check` before opening a PR; both must pass cleanly.
3. Keep PRs focused — small, reviewable changes are much easier to merge than large ones.

If you're proposing a bigger feature (new data fields, a new page, etc.), please open an issue first to discuss the approach.

## License

[MIT](./LICENSE) © [SalzDevs](https://github.com/SalzDevs)
