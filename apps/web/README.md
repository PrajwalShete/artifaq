# @artifaq/web

React + Vite app. Points at a local folder via the File System Access API, lists every `.html`
file (including nested), and publishes selected files to the Worker as stable shareable URLs.

## Run

```bash
pnpm dev               # http://localhost:5173
pnpm typecheck
pnpm build             # static files in ./dist
```

In dev, the worker should be running separately:

```bash
# In another terminal
cd ../worker && pnpm dev   # http://localhost:8787
```

Then set `VITE_API_BASE=http://localhost:8787` in `apps/web/.env` so the publish call hits the
local worker.

## Tech notes

- **Chromium only.** Detected at boot — non-Chromium browsers see a friendly gate, not a crash.
- **`FileSystemDirectoryHandle` stored in IndexedDB** via `idb-keyval`. Reopens skip the picker if
  permission persists.
- **`FileSystemObserver`** (Chrome 133+) is the primary watch path, with a 3-second polling
  fallback while the tab is visible.
- **Recursive walk** filters to `.html` only and skips `.git`, `node_modules`, `dist`, etc.
- **Stable URL per file path.** Every published file's slot id is remembered in IndexedDB and
  reused on republish, so the URL never rots after AI edits.
- **Content-hash dedup.** Republish of identical bytes is a no-op on the server.

## Keyboard

| Key       | Action                              |
| --------- | ----------------------------------- |
| `j` / `k` | Move focus between files            |
| `space`   | Toggle preview                      |
| `↵`       | Publish (or copy URL if live)       |
| `/`       | Focus filter                        |
| `esc`     | Clear filter / close help           |
| `?`       | Toggle keyboard help                |
