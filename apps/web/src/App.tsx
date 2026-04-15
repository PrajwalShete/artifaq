import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserGate } from './components/BrowserGate.js';
import { FileTree, type RowState, type Status } from './components/FileTree.js';
import { FolderPicker } from './components/FolderPicker.js';
import { KeyboardHelp } from './components/KeyboardHelp.js';
import { PermissionBanner } from './components/PermissionBanner.js';
import { SearchBar } from './components/SearchBar.js';
import { ToastHost } from './components/Toast.js';
import { useNow } from './hooks/useNow.js';
import { useToast } from './hooks/useToast.js';
import { detectSupport } from './lib/browser.js';
import { writeClipboard } from './lib/clipboard.js';
import {
  clearRoot,
  loadCollapsed,
  loadRoot,
  loadSlotMap,
  rememberSlot,
  type SlotMap,
  saveCollapsed,
  saveRoot,
} from './lib/handle-store.js';
import { sha256Hex } from './lib/hash.js';
import { watch } from './lib/observer.js';
import { checkReadable, ensureReadable } from './lib/permissions.js';
import { publishArtifact } from './lib/publish.js';
import { readFile, type TreeFile, type TreeNode, walk } from './lib/walk.js';

type Phase = 'loading' | 'unsupported' | 'no-folder' | 'needs-grant' | 'ready';

const NEW_WINDOW_MS = 60_000;

export function App() {
  const support = useMemo(() => detectSupport(), []);
  const [phase, setPhase] = useState<Phase>('loading');
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [walking, setWalking] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<Set<string>>(new Set());
  const [newSince, setNewSince] = useState<Map<string, number>>(new Map());
  const [mappings, setMappings] = useState<SlotMap>({});
  const [showHelp, setShowHelp] = useState(false);

  const { items: toasts, push: pushToast, dismiss: dismissToast } = useToast();
  const now = useNow(30_000);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ----- boot -----
  useEffect(() => {
    if (!support.supported) {
      setPhase('unsupported');
      return;
    }
    (async () => {
      const stored = await loadRoot();
      if (!stored) {
        setPhase('no-folder');
        return;
      }
      setHandle(stored);
      const granted = await checkReadable(stored);
      if (granted === 'granted') {
        setPhase('ready');
      } else if (granted === 'denied') {
        await clearRoot();
        setPhase('no-folder');
      } else {
        setPhase('needs-grant');
      }
      setCollapsed(await loadCollapsed());
      setMappings(await loadSlotMap());
    })().catch((err) => {
      console.error('Boot failed', err);
      setPhase('no-folder');
    });
  }, [support.supported]);

  // ----- walk + watch -----
  // refresh has stable identity so the observer doesn't tear down on every state change.
  // Fresh state is read via setState callbacks instead of closure capture.
  const refresh = useCallback(async (h: FileSystemDirectoryHandle) => {
    try {
      setWalking(true);
      const next = await walk(h);
      const appearedAt = Date.now();
      setNodes((prev) => {
        const prevPaths = new Set(prev.filter((n) => n.kind === 'file').map((n) => n.path));
        const isFirstWalk = prevPaths.size === 0;
        setNewSince((prevNew) => {
          const fresh = new Map(prevNew);
          if (!isFirstWalk) {
            for (const n of next) {
              if (n.kind === 'file' && !prevPaths.has(n.path)) {
                fresh.set(n.path, appearedAt);
              }
            }
          }
          for (const [p, ts] of fresh) {
            if (appearedAt - ts > NEW_WINDOW_MS) fresh.delete(p);
          }
          return fresh;
        });
        return next;
      });
    } catch (err) {
      console.error('walk failed', err);
      const granted = await checkReadable(h);
      if (granted !== 'granted') setPhase('needs-grant');
    } finally {
      setWalking(false);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'ready' || !handle) return;
    let active = true;
    void refresh(handle);
    const watcher = watch(handle, () => {
      if (active) void refresh(handle);
    });
    return () => {
      active = false;
      watcher.stop();
    };
  }, [phase, handle, refresh]);

  // ----- collapse persistence -----
  useEffect(() => {
    void saveCollapsed([...collapsed]);
  }, [collapsed]);

  // ----- focus management -----
  const fileNodes = useMemo(() => nodes.filter((n): n is TreeFile => n.kind === 'file'), [nodes]);

  useEffect(() => {
    if (focusedPath && rowRefs.current.has(focusedPath)) {
      const el = rowRefs.current.get(focusedPath);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedPath]);

  // ----- actions -----
  const pickFolder = useCallback(async () => {
    try {
      const picked = await window.showDirectoryPicker({ id: 'artifaq-root', mode: 'read' });
      await saveRoot(picked);
      setHandle(picked);
      setPhase('ready');
    } catch (err) {
      if (!(err instanceof DOMException) || err.name !== 'AbortError') {
        console.error('pick failed', err);
        pushToast({ kind: 'error', text: 'Could not open folder' });
      }
    }
  }, [pushToast]);

  const grantAgain = useCallback(async () => {
    if (!handle) return;
    const ok = await ensureReadable(handle);
    if (ok) setPhase('ready');
    else pushToast({ kind: 'error', text: 'Permission denied' });
  }, [handle, pushToast]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const copyLink = useCallback(
    async (url: string) => {
      const ok = await writeClipboard(url);
      pushToast({
        kind: ok ? 'success' : 'error',
        text: ok ? `copied · ${url.replace(/^https?:\/\//, '')}` : 'Could not copy',
      });
    },
    [pushToast],
  );

  const publish = useCallback(
    async (file: TreeFile) => {
      setPublishing((prev) => new Set(prev).add(file.path));
      try {
        const f = await readFile(file.handle);
        const buf = await f.arrayBuffer();
        const contentHash = await sha256Hex(buf);
        const existing = mappings[file.path];
        const res = await publishArtifact({
          filename: file.name,
          body: buf,
          contentHash,
          slotId: existing?.slotId,
        });
        const mapping = {
          slotId: res.slotId,
          url: res.url,
          rawUrl: res.rawUrl,
          updatedAt: res.updatedAt,
          contentHash,
        };
        await rememberSlot(file.path, mapping);
        setMappings((m) => ({ ...m, [file.path]: mapping }));
        await writeClipboard(res.url);
        pushToast({
          kind: 'success',
          text: `copied · ${res.url.replace(/^https?:\/\//, '')}`,
        });
      } catch (err) {
        const e = err as { message?: string };
        console.error('publish failed', err);
        pushToast({ kind: 'error', text: e.message ?? 'Publish failed' });
      } finally {
        setPublishing((prev) => {
          const next = new Set(prev);
          next.delete(file.path);
          return next;
        });
      }
    },
    [mappings, pushToast],
  );

  // ----- keyboard -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

      if (e.key === '/' && !inField) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === '?' && !inField) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        else if (filter) setFilter('');
        return;
      }
      if (inField) return;

      if (e.key === 'j' || e.key === 'k') {
        const idx = focusedPath ? fileNodes.findIndex((n) => n.path === focusedPath) : -1;
        const next = e.key === 'j' ? idx + 1 : idx - 1;
        const target = fileNodes[next];
        if (target) {
          e.preventDefault();
          setFocusedPath(target.path);
        }
        return;
      }
      if (e.key === ' ' && focusedPath) {
        e.preventDefault();
        setPreviewPath((p) => (p === focusedPath ? null : focusedPath));
        return;
      }
      if (e.key === 'Enter' && focusedPath) {
        e.preventDefault();
        const file = fileNodes.find((n) => n.path === focusedPath);
        if (file) {
          const m = mappings[file.path];
          if (rowStatusFor(file, m, publishing, newSince) === 'live' && m) {
            void copyLink(m.url);
          } else {
            void publish(file);
          }
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedPath, fileNodes, filter, showHelp, mappings, publishing, newSince, copyLink, publish]);

  // ----- row state -----
  const rowState = useCallback(
    (path: string): RowState => {
      const file = fileNodes.find((n) => n.path === path);
      if (!file) return { status: 'untouched' };
      const mapping = mappings[path];
      const isPublishing = publishing.has(path);
      const status = rowStatusFor(file, mapping, publishing, newSince);
      const livenessStale =
        status === 'live' && !!mapping && file.lastModified > Date.parse(mapping.updatedAt);
      return { status, publishing: isPublishing, livenessStale };
    },
    [fileNodes, mappings, newSince, publishing],
  );

  // ----- render -----
  if (phase === 'unsupported') {
    return <BrowserGate support={support} />;
  }
  if (phase === 'loading') return null;
  if (phase === 'no-folder') {
    return <FolderPicker onPick={pickFolder} hasStoredHandle={false} />;
  }

  const folderName = handle?.name ?? '';
  const liveCount = Object.keys(mappings).filter((p) => fileNodes.some((f) => f.path === p)).length;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <span>artifaq</span>
        </div>
        <div className="actions">
          <button
            type="button"
            className="help-toggle"
            onClick={() => setShowHelp(true)}
            aria-label="Keyboard help"
          >
            ?
          </button>
        </div>
      </header>

      {phase === 'needs-grant' ? <PermissionBanner onGrant={grantAgain} /> : null}

      <SearchBar
        ref={searchRef}
        value={filter}
        onChange={setFilter}
        placeholder={`filter ${folderName}`}
      />

      <div className="tree-summary">
        <span className="path" title={folderName}>
          {folderName ? `./${folderName}` : ''}
        </span>
        <span>
          {walking ? 'scanning…' : `${fileNodes.length} file${fileNodes.length === 1 ? '' : 's'}`}
          {liveCount > 0 ? ` · ${liveCount} live` : ''}
        </span>
      </div>

      {fileNodes.length === 0 && !walking ? (
        <div style={{ padding: '40px 6px', color: 'var(--ink-3)', fontSize: 13 }}>
          No HTML files in this folder yet. We're watching — anything you (or Claude) drops in will
          appear here.
        </div>
      ) : (
        <FileTree
          nodes={nodes}
          collapsed={collapsed}
          toggleFolder={toggleFolder}
          filter={filter}
          rowState={rowState}
          mappings={mappings}
          focusedPath={focusedPath}
          setFocused={setFocusedPath}
          previewPath={previewPath}
          setPreview={setPreviewPath}
          publish={publish}
          copyLink={copyLink}
          rowRefs={rowRefs}
          now={now}
        />
      )}

      <ToastHost items={toasts} dismiss={dismissToast} />
      {showHelp ? <KeyboardHelp onClose={() => setShowHelp(false)} /> : null}
    </div>
  );
}

function rowStatusFor(
  file: TreeFile,
  mapping: { contentHash: string } | undefined,
  publishing: Set<string>,
  newSince: Map<string, number>,
): Status {
  if (mapping) return 'live';
  if (publishing.has(file.path)) return 'draft';
  if (newSince.has(file.path)) return 'new';
  return 'untouched';
}
