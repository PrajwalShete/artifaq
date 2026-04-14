# artifaq

> Point at a folder. Publish what matters.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-F69220?logo=pnpm&logoColor=white)](pnpm-workspace.yaml)

A tiny tool for the moment after an AI agent drops an HTML artifact in your folder. Pick the file
worth sharing, get a stable URL, paste it in Slack. No install, no upload-everything, no canvas.

## Table of contents

- [Why this exists](#why-this-exists)
- [How it works](#how-it-works)
- [What's in here](#whats-in-here)
- [Quickstart](#quickstart)
- [Development](#development)
- [Deploying](#deploying)
- [Design decisions](#design-decisions)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Why this exists

Claude, Cursor, and friends increasingly leave you with a working `.html` file sitting on disk
instead of a chat-window artifact. Getting that in front of someone else means picking between
too much friction (git init, deploy, wait for a build) or too little safety (pasting raw HTML
into a tool that will `eval` it for you). artifaq is the five-second middle ground: point it at
the folder, click publish on the file that matters, get back a URL that's safe to share and
already in your clipboard.

## How it works

```
┌──────────────────────────┐         ┌────────────────────┐         ┌──────────────────────────┐
│  CHROMIUM · app.artifaq  │  POST   │  Cloudflare Worker │   PUT   │  R2 (artifaq-artifacts)  │
│                          │ ──────▶ │  (Hono)            │ ──────▶ │  served on art.…-user.…  │
│  FS Access API           │         │  rate-limit, hash  │         │  CSP: sandbox · nosniff  │
└──────────────────────────┘         └────────────────────┘         └──────────────────────────┘
```

1. **You** open the app (web or desktop) and pick a local folder. It lists every `.html` inside,
   nested subfolders included.
2. **You** click *publish* on one. A toast appears with the URL — already in your clipboard.
3. **Anyone** opens that URL. They see the artifact, sandboxed. No account, no install.

When the file changes on disk, click *publish* again — the URL stays the same. Each local file
path maps to one slot id, so the link you pasted in Slack keeps working after the next edit.

## What's in here

| Path                  | What it is                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `apps/web`             | Vite + React app. Runs in any Chromium browser via the FS Access API.    |
| `apps/desktop`         | Tauri 2 desktop app (macOS + Windows) — native filesystem + folder watch, no Chromium-only API limits. |
| `apps/worker`          | Cloudflare Worker (Hono). Publish + serve + viewer page.                 |
| `packages/shared`      | Zod schemas, constants, error types shared across all three.             |
| `.github/workflows`    | CI + one-push deploy + PR previews + signed desktop releases.            |
| `v1-plan.html`         | The original product/architecture plan this was built from.             |

## Quickstart

You need: Node 22+, pnpm 10+, and (for deploy) a Cloudflare account.

```bash
git clone https://github.com/PrajwalShete/artifaq.git && cd artifaq
pnpm install
```

### Run the web app locally

Two terminals:

```bash
# 1) worker on http://localhost:8787
pnpm --filter @artifaq/worker dev

# 2) web on http://localhost:5173
echo 'VITE_API_BASE=http://localhost:8787' > apps/web/.env.local
pnpm --filter @artifaq/web dev
```

Open <http://localhost:5173>, pick a folder of HTML files, click **publish** on one. The toast
shows your URL.

### Run the desktop app locally

Needs Rust too (`rustup` from <https://rustup.rs>):

```bash
pnpm --filter @artifaq/desktop tauri dev
```

Full desktop-specific docs (architecture, build, signing, keyboard shortcuts) live in
[`apps/desktop/README.md`](apps/desktop/README.md).

## Development

```bash
pnpm lint        # Biome
pnpm typecheck   # tsc --noEmit across the workspace
pnpm test        # Vitest — worker uses miniflare, web/desktop use jsdom
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

### GitHub repo secrets (web + worker)

| Secret                    | Source                                                |
| ------------------------- | ----------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`    | Cloudflare → API Tokens. Scope: Workers + Pages + R2. |
| `CLOUDFLARE_ACCOUNT_ID`   | Cloudflare → right sidebar.                           |
| `TURNSTILE_SECRET`        | Cloudflare → Turnstile → site secret key.             |

Push to `main`. The workflow runs **verify → deploy-worker → deploy-web**. If the worker fails,
Pages doesn't deploy.

Desktop releases (signed installers + auto-update) are handled separately by
`.github/workflows/desktop.yml` on tag push — see
[`apps/desktop/README.md`](apps/desktop/README.md#ci--signing--auto-update) for the full secret
list.

## Design decisions

- **Cloudflare R2 over S3.** Free egress is the line item that changes the math. ~$3/mo for 100k
  artifacts vs ~$22/mo on AWS at the same scale. We get faster too, because R2 already lives at
  the edge.
- **Separate eTLD+1 for artifacts.** `art.artifaq-user.net` is registered separately from
  `artifaq.io` so user-uploaded HTML can never read app cookies. This is the github / cdpn pattern.
- **Anonymous, capability URLs.** 12-char nanoid ≈ 71 bits. No login for v1. Turnstile + IP rate
  limit keep bots out. 30-day TTL keeps storage bounded.
- **Stable URL on republish.** Each local file path maps to one slot id, persisted in IndexedDB
  (web) or on-disk state (desktop). Re-publishing the same file overwrites at the same URL.
- **Chromium only for the web app; native for desktop.** File System Access API +
  FileSystemObserver only exist on Chromium — the desktop app exists specifically to remove that
  limit by talking to the OS filesystem directly. Viewers of a published artifact can use any
  browser, any device, either way.

Full design doc is at [`v1-plan.html`](./v1-plan.html).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, coding conventions, and how PRs are
reviewed.

## Security

See [SECURITY.md](./SECURITY.md) for the threat model and how to report a vulnerability.

## License

MIT — see [LICENSE](./LICENSE).
