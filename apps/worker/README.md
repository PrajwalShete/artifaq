# @artifaq/worker

Cloudflare Worker (Hono) that accepts HTML uploads, stores them in R2 with a nanoid slot, and serves them with sandboxed CSP from a separate domain.

## Routes

| Method | Path        | Description                                     |
| ------ | ----------- | ----------------------------------------------- |
| `GET`  | `/health`   | Liveness probe                                  |
| `POST` | `/publish`  | Upload an HTML file; returns slot + URLs        |
| `GET`  | `/a/:id`    | Viewer page (iframes the raw artifact)          |
| `GET`  | `/raw/:id`  | Raw HTML, served with `CSP: sandbox` + `nosniff`|

## Publish flow

```
POST /publish[?slot=<existing>]
  Content-Type: text/html; charset=utf-8
  X-Original-Filename: <name>
  X-Content-Hash: <sha256-hex>   (optional, server-verified)
  CF-Turnstile-Token: <token>    (required in production)
  Body: <html>...</html>

→ 201 (new) | 200 (no-op republish)
{
  "slotId": "k3n9pQr2Lm4x",
  "url": "https://art.example.net/a/k3n9pQr2Lm4x",
  "rawUrl": "https://art.example.net/raw/k3n9pQr2Lm4x",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Local dev

```bash
cp .dev.vars.example .dev.vars   # optional, only needed to test Turnstile
pnpm dev                          # wrangler dev
pnpm test                         # vitest with miniflare-backed R2/KV
```

## Deploy

Production deploys run from CI (`.github/workflows/ci.yml`). Manual deploy:

```bash
pnpm deploy           # uses [env.production] from wrangler.jsonc
```

Before first deploy you must create the R2 bucket and KV namespace, then paste their IDs into `wrangler.jsonc`:

```bash
wrangler r2 bucket create artifaq-artifacts-prod
wrangler kv namespace create RATE_LIMIT --env production
wrangler secret put TURNSTILE_SECRET --env production
```

A 30-day-from-creation lifecycle is the operational expiration policy — apply via the R2 dashboard or:

```bash
wrangler r2 bucket lifecycle add artifaq-artifacts-prod \
  --id expire-30d --prefix artifacts/ --expire-days 30
```

## Architecture notes

- **R2 binding, not S3 API.** Direct `env.ARTIFACTS.put()` — no signing, lower latency.
- **Direct PUT, not multipart.** 5MB cap is well under the Workers 100MB request-body ceiling.
- **Content-hash dedup.** Republishing the same bytes returns the existing record without writing.
- **Stable slot URL.** Re-publish with `?slot=existing` to update in place; URL never changes.
- **Sandbox CSP on `/raw`.** `sandbox allow-scripts allow-forms allow-popups` — user HTML can never reach our cookies because it's served from a different eTLD+1.
- **KV rate limit** is eventually consistent. For strict global limits in v2, switch to the native Rate Limiting binding.
