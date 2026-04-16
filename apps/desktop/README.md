# @artifaq/desktop

Tauri 2 desktop app for macOS + Windows. React + Vite frontend, Rust backend, native filesystem,
native folder watching, premium macOS chrome (vibrancy + inset traffic lights + native menus).

## Run locally

You need: Node 22+, pnpm 10+, **Rust** (`rustup` from <https://rustup.rs>).

```bash
pnpm install                    # from repo root
pnpm --filter @artifaq/desktop tauri dev
```

The Tauri dev command starts Vite + the Rust dev binary and live-reloads both.

## Why this app exists

The browser-based artifaq fights two things at once: (1) the File System Access API is Chromium-only,
and (2) some Chromium browsers (Brave) gate the API behind a flag for fingerprinting reasons. The
desktop app eliminates both — it talks to the OS filesystem directly.

## How the pieces fit

```
┌─────────────────────────────────────────────────────────────┐
│ Tauri WebView (React + Vite)                                │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Sidebar          │  │ Main view                        │ │
│  │  • Folders       │  │  • iframe(asset://<abs-path>)    │ │
│  │  • Tree          │  │  • publish / copy-link bar       │ │
│  │  • Recents       │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│                                                             │
└────────────┬────────────────────────────────────────────────┘
             │ invoke / events
┌────────────▼────────────────────────────────────────────────┐
│ Rust (src-tauri)                                            │
│                                                             │
│  open_folder   →  tauri-plugin-dialog                       │
│  walk_html     →  ignore::WalkBuilder (gitignore-aware)     │
│  watch_folder  →  notify-debouncer-full → emit folder:changed│
│  unwatch_folder                                             │
│                                                             │
│  window-vibrancy (NSVisualEffectMaterial::Sidebar on macOS) │
│  Menu API (File / Edit / View / Window / Help)              │
└─────────────────────────────────────────────────────────────┘
```

The iframe loads the local file directly via Tauri's asset protocol (`convertFileSrc` →
`asset://localhost/<path>`). No IPC round-trip, no base64. The protocol lives on a different
origin than the app webview, so user HTML is isolated from the app's JS context. For publishing
we `fetch(convertFileSrc(path))` to get the bytes and POST them to the Worker.

## File layout

```
apps/desktop/
├── package.json
├── vite.config.ts
├── index.html
├── src/                      # React frontend
│   ├── main.tsx · App.tsx · index.css
│   ├── components/           # Sidebar · MainView · FolderTree · Toast · KeyboardHelp · …
│   ├── hooks/                # useNow · useToast
│   ├── lib/                  # ipc · store · publish · hash · clipboard · notify · format · id
│   └── env.d.ts
└── src-tauri/                # Rust backend
    ├── Cargo.toml
    ├── tauri.conf.json       # productName, windows, security/CSP, bundle targets, updater
    ├── capabilities/default.json
    ├── icons/
    └── src/
        ├── main.rs · lib.rs
        ├── error.rs · state.rs
        └── commands/
            ├── dialog.rs     # open_folder
            ├── walk.rs       # walk_html (ignore::WalkBuilder + prune empties)
            └── watch.rs      # watch_folder / unwatch_folder (notify-debouncer-full)
```

## Premium chrome

- **Inset traffic lights:** `titleBarStyle: "Overlay"` + `hiddenTitle: true`. CSS reserves
  90px on the left of the drag region. `data-tauri-drag-region` on the titlebar element
  marks it as the OS drag area.
- **Vibrancy:** `window-vibrancy` applied with `NSVisualEffectMaterial::Sidebar` in `setup()`.
  `macOSPrivateApi: true` + `transparent: true` required.
- **Native menus:** Tauri 2 `MenuBuilder` defines File / Edit / View / Window / Help.
  Custom items emit a `menu` event to the frontend.
- **Quiet notifications:** `tauri-plugin-notification` — no sound on the "URL copied" toast.

## Build

A release build:

```bash
pnpm --filter @artifaq/desktop tauri build
```

Outputs land in `apps/desktop/src-tauri/target/release/bundle/`:

- macOS: `dmg/Artifaq_0.0.0_<arch>.dmg`, `macos/Artifaq.app.tar.gz` (+ `.sig`)
- Windows: `nsis/Artifaq_0.0.0_x64-setup.exe`, `nsis/Artifaq_0.0.0_x64-setup.nsis.zip` (+ `.sig`)

Expected installer size: ~8-12 MB.

## CI · signing · auto-update

`.github/workflows/desktop.yml` runs on tag push (`v*`) — builds the macOS Apple Silicon, macOS
Intel, and Windows targets in parallel, signs each (Apple Developer ID notarization for macOS,
Azure Trusted Signing for Windows), creates a draft GitHub Release, then publishes a `latest.json`
manifest to Cloudflare R2 at `https://releases.artifaq.io/latest.json`. The Tauri updater plugin
polls this endpoint on app start and on the user's request.

### Required GitHub secrets

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Updater signing private key (`tauri signer generate`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the above |
| `APPLE_CERTIFICATE` | Developer ID Application cert (`.p12` base64) |
| `APPLE_CERTIFICATE_PASSWORD` | Cert password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Acme (TEAMID)` |
| `APPLE_API_ISSUER` · `APPLE_API_KEY` · `APPLE_API_KEY_PATH` | App Store Connect API key (preferred) |
| `AZURE_TENANT_ID` · `AZURE_CLIENT_ID` · `AZURE_CLIENT_SECRET` | Azure Trusted Signing |
| `AZURE_CODE_SIGNING_NAME` · `AZURE_CERT_PROFILE_NAME` | Trusted Signing account info |
| `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_ENDPOINT` · `R2_RELEASES_BUCKET` | R2 release host |

### One-time updater key

```bash
pnpm --filter @artifaq/desktop tauri signer generate -w ~/.artifaq-updater.key
# Paste the printed pubkey into tauri.conf.json → plugins.updater.pubkey
# Add the private key + password as GitHub secrets
```

## Local-dev tips

- Tauri serves the frontend at `http://localhost:1420`. If you want to test with a remote worker
  in dev, set `VITE_API_BASE=http://localhost:8787` in `apps/desktop/.env.local`.
- Use `pnpm --filter @artifaq/desktop dev:vite` to run the frontend alone in a browser tab —
  Tauri features (folder pick, watch) won't work, but UI iteration is fast.
- `cargo check` from `apps/desktop/src-tauri/` for Rust-only typecheck.

## What's deliberately missing in v1

- Multi-window. One window is enough.
- Tray icon / menu-bar app. Could ship in v2 once "publish my last HTML" is a real workflow.
- Tauri-specta auto-generated bindings. Hand-typed `ipc.ts` is fine at 4 commands; add specta
  when the surface doubles.
- Inline editor. The artifact is read-only in the desktop app — edits happen in the user's
  AI tool, which writes the file on disk.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘O` | Open a folder |
| `⌘↵` | Publish selected file (or copy URL if already live) |
| `⌘C` | Copy URL of selected file (when live) |
| `⌘F` | Focus the filter |
| `⌘\` | Toggle sidebar |
| `?` | Toggle keyboard help |
| `Esc` | Clear filter / close overlay |
