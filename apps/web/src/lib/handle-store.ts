import { createStore, del, get, set } from 'idb-keyval';

const store = createStore('artifaq', 'handles');

const ROOT_KEY = 'rootDir';
const COLLAPSE_KEY = 'collapsed';
const SLOTS_KEY = 'slotMap';

export async function saveRoot(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(ROOT_KEY, handle, store);
}

export async function loadRoot(): Promise<FileSystemDirectoryHandle | undefined> {
  return (await get<FileSystemDirectoryHandle>(ROOT_KEY, store)) ?? undefined;
}

export async function clearRoot(): Promise<void> {
  await del(ROOT_KEY, store);
}

export async function saveCollapsed(paths: string[]): Promise<void> {
  await set(COLLAPSE_KEY, paths, store);
}

export async function loadCollapsed(): Promise<Set<string>> {
  const arr = (await get<string[]>(COLLAPSE_KEY, store)) ?? [];
  return new Set(arr);
}

export interface SlotMapping {
  slotId: string;
  url: string;
  rawUrl: string;
  updatedAt: string;
  contentHash: string;
}

export type SlotMap = Record<string, SlotMapping>;

export async function loadSlotMap(): Promise<SlotMap> {
  return (await get<SlotMap>(SLOTS_KEY, store)) ?? {};
}

export async function saveSlotMap(map: SlotMap): Promise<void> {
  await set(SLOTS_KEY, map, store);
}

export async function rememberSlot(path: string, mapping: SlotMapping): Promise<void> {
  const map = await loadSlotMap();
  map[path] = mapping;
  await saveSlotMap(map);
}

export async function forgetSlot(path: string): Promise<void> {
  const map = await loadSlotMap();
  delete map[path];
  await saveSlotMap(map);
}
