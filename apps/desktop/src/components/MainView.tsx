import { relativeTime } from '../lib/format.js';
import { fileUrl } from '../lib/ipc.js';
import type { SlotMapping } from '../lib/store.js';

interface Props {
  abs: string;
  name: string;
  modifiedMs: number;
  slot?: SlotMapping;
  publishing: boolean;
  isStale: boolean;
  now: number;
  onPublish(): void;
  onCopyUrl(): void;
  onOpenInBrowser(): void;
}

export function MainView(p: Props) {
  const src = fileUrl(p.abs);
  const live = !!p.slot;
  return (
    <main className="main">
      <div className="main-bar">
        <div className="main-bar-left">
          <span className="main-name" title={p.abs}>
            {p.name}
          </span>
          <span className="main-meta">edited {relativeTime(p.modifiedMs, p.now)}</span>
        </div>
        <div className="main-bar-right">
          {live ? (
            <>
              <button type="button" className="bar-btn" onClick={p.onCopyUrl} title={p.slot?.url}>
                copy link
              </button>
              <button type="button" className="bar-btn ghost" onClick={p.onOpenInBrowser}>
                open in browser
              </button>
              {p.isStale ? (
                <button
                  type="button"
                  className="bar-btn primary"
                  onClick={p.onPublish}
                  disabled={p.publishing}
                >
                  {p.publishing ? 'pushing…' : 'push update'}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="bar-btn primary"
              onClick={p.onPublish}
              disabled={p.publishing}
            >
              {p.publishing ? 'publishing…' : 'publish'}
            </button>
          )}
        </div>
      </div>

      <div className="main-frame">
        <iframe
          key={`${p.abs}:${p.modifiedMs}`}
          src={src}
          title={p.name}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </div>
    </main>
  );
}
