## What changed

<!-- One sentence on the change. The why goes in the next section. -->

## Why

<!-- Constraint, incident, user ask, or design decision driving this. -->

## How to test

<!-- Steps a reviewer can take to verify, ideally with the preview Pages URL once deployed. -->

## Checklist

- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passes
- [ ] Touched files have no debug `console.log`s
- [ ] If the worker config changed, secrets / KV / R2 instructions are updated in `apps/worker/README.md`
