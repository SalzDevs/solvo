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

There is no universal API to cancel third-party subscriptions, so Solvo uses an **assisted** approach: the Cancel button opens the provider's official cancellation page (or shows stored instructions), and once you confirm, marks it cancelled locally and stops counting its cost. It never stores your provider credentials.

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
│  ├─ registry.ts             # known providers -> official cancel URLs
│  ├─ types.ts                # shared domain types
│  ├─ server/db.ts            # bun:sqlite connection + migrations
│  └─ server/subscriptions.ts # CRUD, cancel, settings, export/import
└─ routes/
   ├─ +page.svelte            # dashboard
   ├─ subscriptions/          # list + add/edit dialog + assisted cancel
   ├─ settings/               # currency, FX rate, export/import
   └─ api/export/             # JSON backup download
```

## Roadmap

- CSV / bank statement import
- Live exchange-rate refresh
- Renewal reminders & notifications (auto-advancing dates and urgency badges are already in)
- Spending trends and charts

## License

[MIT](./LICENSE)
