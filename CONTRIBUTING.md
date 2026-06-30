# Contributing to Solvo

Thanks for considering a contribution — issues and pull requests are welcome.

## Before you start

- For small fixes (typos, obvious bugs, copy tweaks), just open a PR.
- For anything bigger — a new data field, a new page, a new dependency, a change in behavior — please [open an issue](https://github.com/SalzDevs/solvo/issues/new) first to discuss the approach. It's a lot easier to align before code is written than to rework a finished PR.

## Project layout

Most of the interesting logic lives in `src/lib/*.ts` as pure, framework-free TypeScript — `cost.ts`, `renewals.ts`, `subscriptions-filter.ts`, `subscriptions-sort.ts`, `trials.ts`, `url.ts` — each with a matching `*.test.ts`. Routes (`src/routes/`) and `src/lib/server/` glue that logic to SvelteKit and SQLite. See the [README's project structure](./README.md#project-structure) for the full map.

## Setting up

```bash
bun install
bun run dev      # http://localhost:5173, backed by your local solvo.db
bun run demo     # same thing, but against throwaway in-memory seed data
```

## Before opening a PR

```bash
bun run check   # svelte-check — must report 0 errors
bun test        # unit tests — must all pass
bun run build   # production build — must succeed
```

CI runs the same three commands on every PR, so it's faster to catch issues locally first.

## Guidelines

1. **Keep domain logic pure and tested.** If you're adding a rule about cost, dates, sorting, or filtering, it almost certainly belongs in `src/lib/*.ts` with a unit test, not inline in a `.svelte` file or a server action.
2. **Validate at the boundary.** Anything that ends up rendered, opened (`window.open`), or persisted from user input or an imported file should be validated the same way existing fields are (see `src/lib/url.ts` for an example).
3. **Keep PRs focused.** Small, single-purpose PRs are much faster to review and merge than large ones that mix refactors with features.
4. **Match the existing style.** Tabs for indentation, no comments that just restate what the code does, prefer pure functions you can unit test over logic buried in components.

## Reporting bugs / requesting features

Use the issue templates — they ask for just enough context (what you expected, what happened, how to reproduce) to act on quickly.

## Code of conduct

Be respectful and assume good faith. This is a small personal project maintained on a best-effort basis — please be patient with review times.
