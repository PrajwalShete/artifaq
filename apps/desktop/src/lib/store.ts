import { LazyStore } from '@tauri-apps/plugin-store';

/**
 * Persistent app state. Lives in the OS app-data dir as `state.json`.
 * - macOS: ~/Library/Application Support/io.artifaq.desktop/state.json
 * - Windows: %APPDATA%\io.artifaq.desktop\state.json
 */
const store = new LazyStore('state.json', { autoSave: 250, defaults: {} });

export interface PinnedFolder {
  id: string;
  /** Display name (basename of abs path). */
  name: string;
  /** Absolute filesystem path. */
  abs: string;
  /** ISO timestamp of last activation. */
  lastUsed: string;
}

export interface SlotMapping {
  slotId: string;
  url: string;
  rawUrl: string;
  updatedAt: string;
  contentHash: string;
}

export type SlotMap = Record<string, SlotMapping>;

export interface RecentFile {
  abs: string;
  name: string;
  folderAbs: string;
  openedAt: string;
}

const KEYS = {
  pinned: 'pinned',
  active: 'active',
  collapsed: 'collapsed',
  slots: 'slots',
  recents: 'recents',
} as const;

export async function loadPinned(): Promise<PinnedFolder[]> {
  return (await store.get<PinnedFolder[]>(KEYS.pinned)) ?? [];
}

export async function savePinned(folders: PinnedFolder[]): Promise<void> {
  await store.set(KEYS.pinned, folders);
}

export async function loadActive(): Promise<string | null> {
  return (await store.get<string>(KEYS.active)) ?? null;
}

export async function saveActive(id: string | null): Promise<void> {
  if (id) {
    await store.set(KEYS.active, id);
  } else {
    await store.delete(KEYS.active);
  }
}

export async function loadCollapsed(folderId: string): Promise<Set<string>> {
  const all = (await store.get<Record<string, string[]>>(KEYS.collapsed)) ?? {};
  return new Set(all[folderId] ?? []);
}

export async function saveCollapsed(folderId: string, paths: Set<string>): Promise<void> {
  const all = (await store.get<Record<string, string[]>>(KEYS.collapsed)) ?? {};
  all[folderId] = [...paths];
  await store.set(KEYS.collapsed, all);
}

export async function loadSlotMap(): Promise<SlotMap> {
  return (await store.get<SlotMap>(KEYS.slots)) ?? {};
}

export async function rememberSlot(abs: string, mapping: SlotMapping): Promise<void> {
  const map = await loadSlotMap();
  map[abs] = mapping;
  await store.set(KEYS.slots, map);
}

export async function forgetSlot(abs: string): Promise<void> {
  const map = await loadSlotMap();
  delete map[abs];
  await store.set(KEYS.slots, map);
}

export async function loadRecents(): Promise<RecentFile[]> {
  return (await store.get<RecentFile[]>(KEYS.recents)) ?? [];
}

export async function pushRecent(entry: RecentFile, max = 20): Promise<RecentFile[]> {
  const list = await loadRecents();
  const filtered = list.filter((r) => r.abs !== entry.abs);
  filtered.unshift(entry);
  const trimmed = filtered.slice(0, max);
  await store.set(KEYS.recents, trimmed);
  return trimmed;
}

export async function flush(): Promise<void> {
  await store.save();
}
