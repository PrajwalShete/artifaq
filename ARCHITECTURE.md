# Architecture — quick reference

/resume dc292225-db7c-4403-8dce-8f3b3ce23ce5
A one-page mental model of the system. The deep version is in `../v1-plan.html`.

## The shape

```
USER MACHINE                                    CLOUDFLARE EDGE
┌────────────────────────────────────┐          ┌─────────────────────────────────────────┐
│  Chromium browser                  │          │                                         │
│                                    │          │   Worker (api.artifaq.io)               │
│  ┌──────────────────────────────┐  │   POST   │   ┌──────────────────────────────────┐  │
│  │ apps/web (Vite SPA)          │ ─┼─────────▶│  /publish ─▶ rate-limit ─▶ R2 PUT     │  │
│  │                              │  │          │   ┌──────────────────────────────────┐  │
│  │ • showDirectoryPicker        │  │          │   │  R2 (artifaq-artifacts-prod)     │  │
│  │ • walk(.html, recursive)     │  │          │   │  artifacts/<slot>/index.html     │  │
│  │ • FileSystemObserver         │  │          │   │  artifacts/<slot>/meta.json      │  │
│  │ • idb-keyval persist handle  │  │          │   └──────────────────────────────────┘  │
│  │ • IDB slot map: path → slot  │  │          │                                         │
│  └──────────────────────────────┘  │          │   ┌──────────────────────────────────┐  │
│                                    │          │   │  /a/:id ─▶ viewer (iframes /raw) │  │
└────────────────────────────────────┘          │   │  /raw/:id ─▶ HTML + sandbox CSP  │  │
                                                │   └──────────────────────────────────┘  │
                                                │   served on art.artifaq-user.net        │
                                                └─────────────────────────────────────────┘
                                                              ▲
                                                              │ open URL, any browser
                                                              │
                                              ┌─────────────────────────────┐
                                              │  Teammate (any device)      │
                                              └─────────────────────────────┘
```

## Data on disk (R2)

- `artifacts/{slotId}/index.html` — the user's HTML.
- `artifacts/{slotId}/meta.json` — sidecar with `{slotId, filename, contentHash, bytes, createdAt, updatedAt, views}`.
- 30-day expiry from upload via R2 lifecycle rule (`artifacts/` prefix).

## Why a Worker and not just direct R2 PUT from the browser?

- Server-side content hash (trust-but-verify the client's).
- Server-issued slot id (the client could try to forge slots otherwise).
- CORS gate to the app origin only.
- Rate limit, Turnstile, and 5MB cap.

## The slot lifecycle

| Stage     | Storage                                                                |
| --------- | ---------------------------------------------------------------------- |
| Picked    | `(filePath)` in the web app's recursive walk                           |
| Previewed | local Blob URL inside a sandboxed iframe                               |
| Published | `slotId` written to R2 + sidecar meta. Mapping `path → slotId` to IDB. |
| Republish | Same slot id reused. Content-hash dedup short-circuits no-op writes.   |
| Expired   | R2 lifecycle deletes both objects 30 days after creation.              |

## Trust boundaries

- **App ↔ artifact**: hosted on different registrable domains (`artifaq.io` vs `artifaq-user.net`).
  This is the single most important security decision in the system. Same-origin policy + SameSite
  cookies build a real wall.
- **Worker ↔ R2**: binding-based, no signed URLs needed.
- **Browser ↔ disk**: User-granted handle, scoped to the picked directory tree. The app cannot
  read files outside the picked root.

## Non-decisions (skip the bikeshed)

- **No database.** Object metadata + a sidecar `meta.json` is enough at this scale.
- **No CDN config.** Cloudflare's edge fronts R2 automatically through a custom domain.
- **No log aggregator.** Workers Logs is enabled with `head_sampling_rate: 1`.
- **No analytics.** Page views are not tracked. There is no user identity to track them against.

## What will change in v2

- Move rate-limit from KV (eventually consistent) to the native Rate Limiting binding.
- Add `meta.views` increment on each GET (already in the schema).
- Account ("claim with email") flow that converts a `path → slot` to "this is mine forever."
- Server-sent events on the viewer page so teammates get a "new version" toast without refresh.
