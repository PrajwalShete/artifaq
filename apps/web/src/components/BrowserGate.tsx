import type { BrowserSupport } from '../lib/browser.js';

interface Props {
  support: BrowserSupport;
}

const BRAVE_FLAG = 'brave://flags/#file-system-access-api';

export function BrowserGate({ support }: Props) {
  if (support.brand === 'brave') {
    return <BraveGate />;
  }
  return <GenericGate reason={support.reason ?? 'Browser not supported.'} />;
}

function BraveGate() {
  return (
    <div className="center">
      <h1>You're in Brave — almost there.</h1>
      <p>
        Brave disables the File System Access API by default to protect against fingerprinting. Flip
        one flag and you're set.
      </p>

      <ol className="brave-steps">
        <li>
          Paste this into the address bar:
          <code className="brave-flag">{BRAVE_FLAG}</code>
        </li>
        <li>
          Change <strong>File System Access API</strong> from <em>Default</em> to{' '}
          <strong>Enabled</strong>.
        </li>
        <li>
          Click <strong>Relaunch</strong> at the bottom-right.
        </li>
        <li>
          Come back here and{' '}
          <button type="button" className="link-btn" onClick={() => window.location.reload()}>
            reload
          </button>
          .
        </li>
      </ol>

      <p style={{ marginTop: 24, color: 'var(--ink-3)', fontSize: 13 }}>
        Don't want to flip the flag? Open this in Chrome, Edge, Arc, or Opera — they ship it on by
        default.
      </p>
    </div>
  );
}

function GenericGate({ reason }: { reason: string }) {
  return (
    <div className="center">
      <h1>Open this in a Chromium browser.</h1>
      <p>{reason}</p>
      <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
        artifaq uses the File System Access API to read your local HTML files. Only Chromium-based
        browsers support it today.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <a
          className="primary-btn"
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Get Chrome
        </a>
        <a className="ghost-btn" href="https://arc.net/" target="_blank" rel="noreferrer noopener">
          or Arc / Edge / Opera
        </a>
      </div>
      <div className="browser-hint">
        Already on Chrome? Make sure you're not in an in-app browser (LinkedIn, X, Slack).
      </div>
    </div>
  );
}
