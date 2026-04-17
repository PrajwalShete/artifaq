import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type TreeNode =
  | {
      kind: 'folder';
      name: string;
      path: string;
      parent: string;
      depth: number;
      abs: string;
    }
  | {
      kind: 'file';
      name: string;
      path: string;
      parent: string;
      depth: number;
      abs: string;
      size: number;
      modified_ms: number;
    };

export interface FolderChanged {
  watcher_id: number;
  root: string;
}

export async function openFolder(): Promise<string | null> {
  return invoke<string | null>('open_folder');
}

export async function walkHtml(root: string): Promise<TreeNode[]> {
  return invoke<TreeNode[]>('walk_html', { root });
}

export async function watchFolder(root: string): Promise<number> {
  return invoke<number>('watch_folder', { root });
}

export async function unwatchFolder(watcherId: number): Promise<void> {
  return invoke<void>('unwatch_folder', { watcherId });
}

export function onFolderChanged(handler: (payload: FolderChanged) => void): Promise<UnlistenFn> {
  return listen<FolderChanged>('folder:changed', (event) => handler(event.payload));
}

export function onMenuEvent(handler: (id: string) => void): Promise<UnlistenFn> {
  return listen<string>('menu', (event) => handler(event.payload));
}

/**
 * Turn an absolute filesystem path into a URL the webview can load.
 * Used as iframe `src` and `fetch()` source — no IPC round-trip, no base64.
 */
export function fileUrl(absPath: string): string {
  return convertFileSrc(absPath);
}

/**
 * Fetch a local file's bytes via the asset protocol. The CSP allows
 * `connect-src asset:` for this; the bytes come back as an ArrayBuffer.
 */
export async function readFileBytes(absPath: string): Promise<ArrayBuffer> {
  const res = await fetch(fileUrl(absPath));
  if (!res.ok) {
    throw new Error(`Could not read file (HTTP ${res.status})`);
  }
  return res.arrayBuffer();
}
