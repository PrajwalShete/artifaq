# artifaq

> Point at a folder. Publish what matters.

A tiny tool for the moment after an AI agent drops an HTML artifact in your folder. Pick the files
worth sharing, get a stable URL, paste it in Slack. No install, no upload-everything, no canvas.

```
┌──────────────────────────┐         ┌────────────────────┐         ┌──────────────────────────┐
│  CHROMIUM · app.artifaq  │  POST   │  Cloudflare Worker │   PUT   │  R2 (artifaq-artifacts)  │
│                          │ ──────▶ │  (Hono)            │ ──────▶ │  served on art.…-user.…  │
│  FS Access API           │         │  rate-limit, hash  │         │  CSP: sandbox · nosniff  │
└──────────────────────────┘         └────────────────────┘         └──────────────────────────┘
```

## What's in here

| Path                  | What it is                                                            |
| --------------------- | --------------------------------------------------------------------- |
| `apps/web`            | Vite + React app. The whole client.                                   |
| `apps/worker`         | Cloudflare Worker (Hono). Publish + serve + viewer page.              |
| `packages/shared`     | Zod schemas, constants, error types shared by both.                   |
| `.github/workflows`   | CI + one-push deploy + PR previews.                                   |

## Quickstart

You need: Node 22+, pnpm 10+, and (for deploy) a Cloudflare account.

```bash
git clone https://github.com/PrajwalShete/artifaq.git && cd artifaq
pnpm install
```

### Run it locally

Two terminals:

```bash
# 1) worker on http://localhost:8787
pnpm --filter @artifaq/worker dev

# 2) web on http://localhost:5173
echo 'VITE_API_BASE=http://localhost:8787' > apps/web/.env.local
pnpm --filter @artifaq/web dev
```

Open <http://localhost:5173>, pick a folder of HTML files, click **publish** on one.
The toast shows your URL.

### Run all the checks

```bash
pnpm lint        # Biome
pnpm typecheck   # tsc --noEmit across the workspace
pnpm test        # Vitest (worker uses miniflare, web uses jsdom)
pnpm build       # everything
```

## Deploying

Push to `main` and the GitHub Action does the rest. First time, you need to set these up once:

### One-time Cloudflare setup

```bash
# Create the R2 bucket
wrangler r2 bucket create artifaq-artifacts-prod

# Create the KV namespace (note the IDs printed)
wrangler kv namespace create RATE_LIMIT --env production

# Apply the lifecycle rule for 30-day expiry
wrangler r2 bucket lifecycle add artifaq-artifacts-prod \
  --id expire-30d --prefix artifacts/ --expire-days 30

# Set Turnstile secret
wrangler secret put TURNSTILE_SECRET --env production
```

Paste the KV namespace ID into `apps/worker/wrangler.jsonc` under
`env.production.kv_namespaces`.

Create a Cloudflare Pages project named `artifaq-web` (just for the project to exist —
deploys come from CI).

### GitHub repo secrets

| Secret                    | Source                                                |
| ------------------------- | ----------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`    | Cloudflare → API Tokens. Scope: Workers + Pages + R2. |
| `CLOUDFLARE_ACCOUNT_ID`   | Cloudflare → right sidebar.                           |
| `TURNSTILE_SECRET`        | Cloudflare → Turnstile → site secret key.             |

Push to `main`. The workflow runs **verify → deploy-worker → deploy-web**. If the worker fails,
Pages doesn't deploy.

## The product, in three lines

1. **You** open the app, pick a local folder. The app lists every `.html` inside (nested too).
2. **You** click *publish* on one. A toast appears with the URL — already in your clipboard.
3. **Anyone** opens that URL. They see the artifact. No account. No install.

When the file changes on disk, click *publish* again — the URL stays the same.

## Why these choices

- **Cloudflare R2 over S3.** Free egress is the line item that changes the math. ~$3/mo for 100k
  artifacts vs ~$22/mo on AWS at the same scale. We get faster too, because R2 already lives at
  the edge.
- **Separate eTLD+1 for artifacts.** `art.artifaq-user.net` is registered separately from
  `artifaq.io` so user-uploaded HTML can never read app cookies. This is the github / cdpn pattern.
- **Anonymous, capability URLs.** 12-char nanoid ≈ 71 bits. No login for v1. Turnstile + IP rate
  limit keep bots out. 30-day TTL keeps storage bounded.
- **Stable URL on republish.** Each local file path maps to one slot id, persisted in IndexedDB.
  Re-publishing the same file overwrites at the same URL — the link you pasted in Slack still
  works after Claude's next edit.
- **Chromium only on the publish side.** File System Access API + FileSystemObserver only exist
  on Chromium. Viewers can use any browser, any device.

Full design doc is at `../v1-plan.html` in the parent folder.

## License

MIT — see [LICENSE](./LICENSE).
