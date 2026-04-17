# Contributing

Thanks for the interest. A few ground rules.

## Setup

```bash
pnpm install
pnpm dev          # runs both apps in parallel
```

## Working

- Branch off `main`. PRs into `main` trigger a Pages preview at `pr-<num>.artifaq-web.pages.dev`.
- Keep commits small and descriptive. We use no enforced commit format, but if you reach for one,
  prefer Conventional Commits.
- Run `pnpm fix` before pushing — it formats + applies safe lint fixes via Biome.

## What lives where

- **Anything shared between web and worker** → `packages/shared`. Zod schemas in particular.
  Importing from across the workspace is enforced; importing from `apps/web` inside the worker
  (or vice versa) will fail typecheck.
- **Worker-only logic** → `apps/worker/src/lib`. Tests in `apps/worker/test`.
- **UI components** → `apps/web/src/components`. Hooks → `apps/web/src/hooks`. Pure utils →
  `apps/web/src/lib`.

## Tests

- Worker uses `@cloudflare/vitest-pool-workers` so tests run inside `workerd` with real R2/KV
  bindings. Don't mock R2 — use the in-memory binding.
- Web uses `vitest + jsdom` for pure utilities. UI behavior that depends on FS Access API is best
  smoke-tested in a real Chrome session.

## What we say no to in v1

If your PR adds any of these, please open an issue first:

- An accounts / login system
- Per-user analytics
- A canvas / spatial UI
- Multi-file (asset bundle) publishing
- Live websocket push to viewers

We will probably get to most of these — but the v1 scope is intentionally narrow.

## Releasing

Pushes to `main` deploy automatically. There is no separate release step.
