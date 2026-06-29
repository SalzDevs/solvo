# Solvo

> _Solvo_ — Latin: to release, to set free, and to pay off. A local-first manager for your recurring subscriptions.

Solvo helps you **see every subscription you pay for**, understand **what it actually costs you per day / month / year**, and **cancel** the ones you don't want — all stored locally on your machine. No accounts, no cloud, no tracking.

## Features

- **Subscription ledger** — track name, price, currency, billing cycle, next renewal, category, and status.
- **Honest cost math** — every subscription is normalized to a per-day rate (using average period lengths) and rolled up into per-day / per-month / per-year totals.
- **Dual currency** — store subscriptions in EUR or USD; the dashboard converts everything into your chosen display currency using an editable, offline-friendly exchange rate.
- **Assisted cancel** — one click opens the provider's official cancellation page (or shows the steps), then marks the subscription cancelled so it drops out of your totals. A bundled registry auto-fills cancellation links for popular services.
- **Local & private** — all data lives in a single SQLite file on your machine. Export/import JSON backups any time.

## How "cancel" works

There is no universal API to cancel third-party subscriptions, so Solvo offers two paths:

1. **Assisted cancel** (always available) — the Cancel button opens the provider's official cancellation page (or shows stored instructions); once you confirm, it's marked cancelled locally and stops counting its cost.
2. **Automatic cancel** (experimental) — for providers with a **cancellation recipe**, Solvo opens a real browser and clicks through the cancellation flow for you, captures a confirmation screenshot, and marks it cancelled. See below.

Solvo never stores your provider credentials.

## In-app automatic cancellation (experimental)

For supported providers, the ⚡ button on a subscription runs a **data-driven recipe** through a real Chromium browser (via Playwright), driven by a separate Node process so the browser never runs inside the web server.

- **No stored passwords.** Real providers open a **visible** browser; you log in yourself (and clear any 2FA/captcha) once. The recipe handles the rest and the session persists in a local browser profile under `.solvo/`.
- **Honest about fragility.** Each provider needs a maintained "recipe" (a list of `goto`/`click`/`fill`/`waitFor`/`assertText` steps). Providers redesign their sites, so recipes break and need updates — this is inherent to browser automation.
- **Proof.** Every run captures a confirmation screenshot you can open from the status panel.

### Setup

Automatic cancellation needs the Chromium binary:

```bash
bunx playwright install chromium
```

### Trying it without a real provider

Solvo ships a **mock "Demo Provider"** site (`/demo-provider`) and a recipe for it, so you can watch the whole flow run end-to-end safely:

```bash
bun run demo            # seeds a "Demo Provider" subscription, among others
# then click the ⚡ button on "Demo Provider"
```

Set `SOLVO_CANCEL_HEADLESS=1` to run the browser headless (used by the tests).

### Adding a recipe for a real provider

Add an entry to `src/lib/cancellation/recipes.ts` (see `REAL_RECIPE_TEMPLATE`). Use a `manual` `waitFor` step to pause for login/2FA, then the click steps for that provider's cancel flow, and an `assertText` step to verify success. The subscription's name must match the recipe's `provider` (case-insensitive).

## Tech stack

- [SvelteKit](https://svelte.dev/) on [Bun](https://bun.sh/)
- [shadcn-svelte](https://shadcn-svelte.com/) + [Tailwind CSS](https://tailwindcss.com/)
- [`bun:sqlite`](https://bun.sh/docs/api/sqlite) for local storage

## Getting started

```bash
bun install
bun run dev
```

Then open the printed URL (default http://localhost:5173).

The database is created automatically as `solvo.db` in the project root. Set the `SOLVO_DB` environment variable to store it elsewhere.

### Demo mode

Want to explore Solvo with sample data without touching your real database?

```bash
bun run demo
```

This boots against a throwaway in-memory database seeded with example subscriptions (varied currencies, billing cycles, and renewal dates). Nothing is persisted.

### Tests

The pure cost and renewal logic is unit-tested with `bun test`:

```bash
bun test
```

### Production build

```bash
bun run build
bun ./build/index.js
```

## Project structure

```
src/
├─ lib/
│  ├─ cost.ts                  # pure cost normalization + currency conversion
│  ├─ charts.ts               # pure 12-month spending projection
│  ├─ renewals.ts             # pure renewal date math
│  ├─ registry.ts             # known providers -> official cancel URLs
│  ├─ types.ts                # shared domain types
│  ├─ cancellation/           # recipe types + provider recipes (data-driven)
│  ├─ server/db.ts            # bun:sqlite connection + migrations
│  ├─ server/subscriptions.ts # CRUD, cancel, settings, export/import
│  └─ server/cancellation.ts  # spawns recipe runs, tracks live status
└─ routes/
   ├─ +page.svelte            # dashboard (totals + charts)
   ├─ subscriptions/          # list, add/edit, assisted + automatic cancel
   ├─ settings/               # currency, FX rate, export/import
   ├─ demo-provider/          # bundled mock site to demo auto-cancel
   └─ api/                    # export, cancel start/status/screenshot
scripts/
└─ cancel-runner.mjs          # standalone Playwright recipe runner (Node)
```

## Roadmap

- CSV / bank statement import
- Live exchange-rate refresh
- Renewal reminders & notifications (auto-advancing dates and urgency badges are already in)
- ~~Spending trends and charts~~ — done: 12-month projection + category donut on the dashboard
- More cancellation recipes for popular providers (automatic cancel engine is already in)

## License

[MIT](./LICENSE)
