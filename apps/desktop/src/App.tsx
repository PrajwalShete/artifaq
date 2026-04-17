import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from './components/EmptyState.js';
import type { FileLikeNode } from './components/FolderTree.js';
import { KeyboardHelp } from './components/KeyboardHelp.js';
import { MainView } from './components/MainView.js';
import { Sidebar } from './components/Sidebar.js';
import { Titlebar } from './components/Titlebar.js';
import { ToastHost } from './components/Toast.js';
import { useNow } from './hooks/useNow.js';
import { useToast } from './hooks/useToast.js';
import { writeClipboard } from './lib/clipboard.js';
import { basename } from './lib/format.js';
import { sha256Hex } from './lib/hash.js';
import { newId } from './lib/id.js';
import {
  onFolderChanged,
  onMenuEvent,
  openFolder,
  readFileBytes,
  type TreeNode,
  unwatchFolder,
  walkHtml,
  watchFolder,
} from './lib/ipc.js';
import { osNotify } from './lib/notify.js';
import { publishArtifact } from './lib/publish.js';
import {
  loadActive,
  loadCollapsed,
  loadPinned,
  loadRecents,
  loadSlotMap,
  type PinnedFolder,
  pushRecent,
  type RecentFile,
  rememberSlot,
  type SlotMap,
  type SlotMapping,
  saveActive,
  saveCollapsed,
  savePinned,
} from './lib/store.js';

const NEW_WINDOW_MS = 60_000;

export function App() {
  const [pinned, setPinned] = useState<PinnedFolder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [selectedAbs, setSelectedAbs] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotMap>({});
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [newAbs, setNewAbs] = useState<Map<string, number>>(new Map());
  const [publishingAbs, setPublishingAbs] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [booted, setBooted] = useState(false);

  const { items: toasts, push: pushToast, dismiss: dismissToast } = useToast();
  const now = useNow(30_000);
  const filterRef = useRef<HTMLInputElement>(null);
  const watcherIdRef = useRef<number | null>(null);
  const activeFolderAbsRef = useRef<string | null>(null);

  // ----- boot -----
  useEffect(() => {
    (async () => {
      const [p, a, r, sm] = await Promise.all([
        loadPinned(),
        loadActive(),
        loadRecents(),
        loadSlotMap(),
      ]);
      setPinned(p);
      setActiveId(a && p.some((f) => f.id === a) ? a : (p[0]?.id ?? null));
      setRecents(r);
      setSlots(sm);
      setBooted(true);
    })().catch((err) => {
      console.error('boot failed', err);
      setBooted(true);
    });
  }, []);

  // ----- collapse state per folder -----
  useEffect(() => {
    if (!activeId) return;
    (async () => setCollapsed(await loadCollapsed(activeId)))();
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    void saveCollapsed(activeId, collapsed);
  }, [activeId, collapsed]);

  // ----- walk + watch active folder -----
  const refresh = useCallback(
    async (root: string) => {
      try {
        const next = await walkHtml(root);
        const appearedAt = Date.now();
        setNodes((prev) => {
          const prevAbs = new Set(prev.filter((n) => n.kind === 'file').map((n) => n.abs));
          const isFirst = prevAbs.size === 0;
          setNewAbs((prevNew) => {
            const fresh = new Map(prevNew);
            if (!isFirst) {
              for (const n of next) {
                if (n.kind === 'file' && !prevAbs.has(n.abs)) {
                  fresh.set(n.abs, appearedAt);
                }
              }
            }
            for (const [abs, ts] of fresh) {
              if (appearedAt - ts > NEW_WINDOW_MS) fresh.delete(abs);
            }
            return fresh;
          });
          return next;
        });
      } catch (err) {
        console.error('walk failed', err);
        pushToast({ kind: 'error', text: 'Could not read folder' });
      }
    },
    [pushToast],
  );

  useEffect(() => {
    const folder = pinned.find((f) => f.id === activeId);
    if (!folder) {
      setNodes([]);
      return;
    }
    activeFolderAbsRef.current = folder.abs;
    let active = true;
    void refresh(folder.abs);
    // Watcher
    (async () => {
      try {
        const id = await watchFolder(folder.abs);
        if (!active) {
          await unwatchFolder(id);
          return;
        }
        watcherIdRef.current = id;
      } catch (err) {
        console.error('watch failed', err);
      }
    })();
    return () => {
      active = false;
      const id = watcherIdRef.current;
      watcherIdRef.current = null;
      if (id !== null) void unwatchFolder(id);
    };
  }, [pinned, activeId, refresh]);

  // ----- folder-changed event -----
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await onFolderChanged(() => {
        const abs = activeFolderAbsRef.current;
        if (abs) void refresh(abs);
      });
    })();
    return () => {
      unlisten?.();
    };
  }, [refresh]);

  // ----- actions -----
  const pickFolder = useCallback(async () => {
    try {
      const picked = await openFolder();
      if (!picked) return;
      const name = basename(picked);
      const id = newId();
      const folder: PinnedFolder = {
        id,
        name,
        abs: picked,
        lastUsed: new Date().toISOString(),
      };
      setPinned((prev) => {
        const exists = prev.find((p) => p.abs === picked);
        if (exists) {
          setActiveId(exists.id);
          void saveActive(exists.id);
          return prev;
        }
        const next = [...prev, folder];
        void savePinned(next);
        return next;
      });
      setActiveId(id);
      await saveActive(id);
    } catch (err) {
      console.error('pick failed', err);
      pushToast({ kind: 'error', text: 'Could not open folder' });
    }
  }, [pushToast]);

  const chooseFolder = useCallback(async (id: string) => {
    setActiveId(id);
    await saveActive(id);
  }, []);

  const removeFolder = useCallback(
    async (id: string) => {
      setPinned((prev) => {
        const next = prev.filter((f) => f.id !== id);
        void savePinned(next);
        return next;
      });
      if (activeId === id) {
        setActiveId(null);
        await saveActive(null);
      }
    },
    [activeId],
  );

  const toggleFolderRow = useCallback((path: string) => {
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

  const selectFile = useCallback((file: FileLikeNode) => {
    setSelectedAbs(file.abs);
    setNewAbs((prev) => {
      if (!prev.has(file.abs)) return prev;
      const next = new Map(prev);
      next.delete(file.abs);
      return next;
    });
    const folderAbs = activeFolderAbsRef.current ?? '';
    void pushRecent({
      abs: file.abs,
      name: file.name,
      folderAbs,
      openedAt: new Date().toISOString(),
    }).then(setRecents);
  }, []);

  const publish = useCallback(
    async (file: FileLikeNode) => {
      setPublishingAbs((prev) => new Set(prev).add(file.abs));
      try {
        const buf = await readFileBytes(file.abs);
        const contentHash = await sha256Hex(buf);
        const existing = slots[file.abs];
        const res = await publishArtifact({
          filename: file.name,
          body: buf,
          contentHash,
          slotId: existing?.slotId,
        });
        const mapping: SlotMapping = {
          slotId: res.slotId,
          url: res.url,
          rawUrl: res.rawUrl,
          updatedAt: res.updatedAt,
          contentHash,
        };
        await rememberSlot(file.abs, mapping);
        setSlots((m) => ({ ...m, [file.abs]: mapping }));
        await writeClipboard(res.url);
        const short = res.url.replace(/^https?:\/\//, '');
        pushToast({ kind: 'success', text: `copied · ${short}` });
        void osNotify('Published', short);
      } catch (err) {
        const e = err as { message?: string };
        console.error('publish failed', err);
        pushToast({ kind: 'error', text: e.message ?? 'Publish failed' });
      } finally {
        setPublishingAbs((prev) => {
          const next = new Set(prev);
          next.delete(file.abs);
          return next;
        });
      }
    },
    [slots, pushToast],
  );

  const actionFile = useCallback(
    (file: FileLikeNode) => {
      const slot = slots[file.abs];
      if (slot) {
        void copyLink(slot.url);
      } else {
        void publish(file);
      }
    },
    [slots, copyLink, publish],
  );

  const chooseRecent = useCallback(
    (r: RecentFile) => {
      const folder = pinned.find((f) => f.abs === r.folderAbs);
      if (folder) {
        setActiveId(folder.id);
        void saveActive(folder.id);
      }
      setSelectedAbs(r.abs);
    },
    [pinned],
  );

  // ----- menu events from Rust -----
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await onMenuEvent((id) => {
        if (id === 'open_folder') void pickFolder();
        else if (id === 'publish_focused') {
          const file = nodes.find((n) => n.kind === 'file' && n.abs === selectedAbs);
          if (file?.kind === 'file') void actionFile(file as FileLikeNode);
        } else if (id === 'toggle_sidebar') setSidebarOpen((v) => !v);
        else if (id === 'focus_filter') filterRef.current?.focus();
        else if (id === 'keyboard_help') setShowHelp((v) => !v);
      });
    })();
    return () => {
      unlisten?.();
    };
  }, [pickFolder, nodes, selectedAbs, actionFile]);

  // ----- keyboard inside the webview -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (e.key === '?' && !inField) {
        e.preventDefault();
        setShowHelp((v) => !v);
      } else if (e.key === 'Escape' && !inField) {
        if (showHelp) setShowHelp(false);
        else if (filter) setFilter('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHelp, filter]);

  // ----- render -----
  const selected: FileLikeNode | undefined = useMemo(() => {
    if (!selectedAbs) return undefined;
    const found = nodes.find((n) => n.kind === 'file' && n.abs === selectedAbs);
    return found?.kind === 'file' ? (found as FileLikeNode) : undefined;
  }, [nodes, selectedAbs]);

  if (!booted) {
    return (
      <div className="app-root">
        <Titlebar />
      </div>
    );
  }

  return (
    <div className={`app-root${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <Titlebar />

      {sidebarOpen && (
        <Sidebar
          ref={filterRef}
          pinned={pinned}
          activeId={activeId}
          recents={recents}
          nodes={nodes}
          collapsed={collapsed}
          filter={filter}
          slots={slots}
          selectedAbs={selectedAbs}
          newAbs={new Set(newAbs.keys())}
          publishingAbs={publishingAbs}
          now={now}
          onPick={pickFolder}
          onChooseFolder={chooseFolder}
          onRemoveFolder={removeFolder}
          onToggleFolder={toggleFolderRow}
          onSelectFile={selectFile}
          onActionFile={actionFile}
          onChooseRecent={chooseRecent}
          onFilterChange={setFilter}
        />
      )}

      {selected ? (
        <MainView
          abs={selected.abs}
          name={selected.name}
          modifiedMs={selected.modified_ms}
          slot={slots[selected.abs]}
          publishing={publishingAbs.has(selected.abs)}
          isStale={isStaleFor(selected, slots)}
          now={now}
          onPublish={() => void publish(selected)}
          onCopyUrl={() => {
            const s = slots[selected.abs];
            if (s) void copyLink(s.url);
          }}
          onOpenInBrowser={() => {
            const s = slots[selected.abs];
            if (s) void openUrl(s.url);
          }}
        />
      ) : pinned.length === 0 ? (
        <EmptyState onPick={pickFolder} />
      ) : (
        <section className="main-empty">
          <p>Select a file from the sidebar to preview it.</p>
        </section>
      )}

      <ToastHost items={toasts} dismiss={dismissToast} />
      {showHelp ? <KeyboardHelp onClose={() => setShowHelp(false)} /> : null}
    </div>
  );
}

function isStaleFor(file: FileLikeNode, slots: SlotMap): boolean {
  const slot = slots[file.abs];
  if (!slot) return false;
  return file.modified_ms > Date.parse(slot.updatedAt);
}
