import { useEffect, useState } from 'react';
import { readFile } from '../lib/walk.js';

interface Props {
  handle: FileSystemFileHandle;
  /**
   * Cache-buster: when this changes (e.g. the underlying file was rewritten on disk and re-walked),
   * we re-read the file even if the handle identity is unchanged. Used in deps on purpose.
   */
  cacheKey: string;
}

export function Preview({ handle, cacheKey }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    // Reference cacheKey so it acts as a dependency without lint complaining about unused vars.
    void cacheKey;
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const file = await readFile(handle);
        const url = URL.createObjectURL(file);
        if (!cancelled) {
          revoke = url;
          setSrc(url);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [handle, cacheKey]);

  return (
    <div className="preview">
      {src ? (
        <iframe
          src={src}
          title="Preview"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          loading="eager"
        />
      ) : (
        <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Loading preview…</div>
      )}
    </div>
  );
}
