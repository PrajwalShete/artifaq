type Callback = () => void;

const DEBOUNCE_MS = 120;

export interface Watcher {
  stop(): void;
}

/**
 * Watch a directory recursively for changes. Uses FileSystemObserver when available (Chrome 133+),
 * falls back to polling. Debounces rapid bursts (e.g. an editor's atomic save).
 */
export function watch(root: FileSystemDirectoryHandle, onChange: Callback): Watcher {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, DEBOUNCE_MS);
  };

  // Native observer
  type FSObserverRecord = { type: string };
  type FSObserverInit = { recursive?: boolean };
  interface FSObserverInstance {
    observe(handle: FileSystemDirectoryHandle, init?: FSObserverInit): Promise<void>;
    disconnect(): void;
  }
  type FSObserverCtor = new (cb: (records: FSObserverRecord[]) => void) => FSObserverInstance;

  const Ctor = (window as unknown as { FileSystemObserver?: FSObserverCtor }).FileSystemObserver;

  if (Ctor) {
    const observer = new Ctor((records) => {
      for (const r of records) {
        if (r.type === 'errored') {
          // Permission lost or root deleted — caller should re-validate.
          flush();
          return;
        }
      }
      flush();
    });
    observer.observe(root, { recursive: true }).catch(() => {
      // Fall back to polling silently.
    });
    return { stop: () => observer.disconnect() };
  }

  // Polling fallback — coarse but reliable. 3s when visible, off when hidden.
  let interval: ReturnType<typeof setInterval> | undefined;
  const start = () => {
    if (interval || document.visibilityState !== 'visible') return;
    interval = setInterval(flush, 3000);
  };
  const stop = () => {
    if (interval) clearInterval(interval);
    interval = undefined;
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') start();
    else stop();
  };
  document.addEventListener('visibilitychange', onVis);
  start();

  return {
    stop: () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
      clearTimeout(timer);
    },
  };
}
