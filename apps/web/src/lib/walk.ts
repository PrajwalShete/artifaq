import { SKIP_DIRECTORIES } from '@artifaq/shared/constants';

export interface TreeFile {
  kind: 'file';
  name: string;
  path: string;
  parent: string;
  handle: FileSystemFileHandle;
  lastModified: number;
  size: number;
}

export interface TreeFolder {
  kind: 'folder';
  name: string;
  path: string;
  parent: string;
  count: number;
  handle: FileSystemDirectoryHandle;
}

export type TreeNode = TreeFile | TreeFolder;

export interface WalkOptions {
  showHidden?: boolean;
}

const HTML_EXT = /\.html?$/i;

async function* iterEntries(
  dir: FileSystemDirectoryHandle,
): AsyncGenerator<FileSystemFileHandle | FileSystemDirectoryHandle> {
  // .values() is the spec method on FileSystemDirectoryHandle.
  for await (const entry of (
    dir as unknown as { values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle> }
  ).values()) {
    yield entry;
  }
}

function shouldSkipDir(name: string, opts: WalkOptions): boolean {
  if (SKIP_DIRECTORIES.has(name)) return true;
  if (!opts.showHidden && name.startsWith('.')) return true;
  return false;
}

function shouldSkipFile(name: string, opts: WalkOptions): boolean {
  if (!opts.showHidden && name.startsWith('.')) return true;
  return !HTML_EXT.test(name);
}

export async function walk(
  root: FileSystemDirectoryHandle,
  opts: WalkOptions = {},
): Promise<TreeNode[]> {
  const out: TreeNode[] = [];
  await walkInto(root, '', '', out, opts);
  return out;
}

async function walkInto(
  dir: FileSystemDirectoryHandle,
  parentPath: string,
  parentKey: string,
  out: TreeNode[],
  opts: WalkOptions,
): Promise<number> {
  const folderEntries: TreeFolder[] = [];
  const fileEntries: TreeFile[] = [];

  for await (const entry of iterEntries(dir)) {
    if (entry.kind === 'directory') {
      if (shouldSkipDir(entry.name, opts)) continue;
      const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      folderEntries.push({
        kind: 'folder',
        name: entry.name,
        path,
        parent: parentKey,
        count: 0,
        handle: entry,
      });
    } else if (entry.kind === 'file') {
      if (shouldSkipFile(entry.name, opts)) continue;
      const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      try {
        const file = await entry.getFile();
        fileEntries.push({
          kind: 'file',
          name: entry.name,
          path,
          parent: parentKey || '__root__',
          handle: entry,
          lastModified: file.lastModified,
          size: file.size,
        });
      } catch {
        // Skip files we can't read (e.g. cloud-tiered, offline).
      }
    }
  }

  // Sort: folders before files inside the same level; folders alpha, files newest-first.
  folderEntries.sort((a, b) => a.name.localeCompare(b.name));
  fileEntries.sort((a, b) => b.lastModified - a.lastModified);

  // Push folder, then recurse and count.
  let totalFiles = fileEntries.length;
  for (const folder of folderEntries) {
    const idx = out.length;
    out.push(folder);
    const count = await walkInto(folder.handle, folder.path, folder.path, out, opts);
    folder.count = count;
    totalFiles += count;
    // Drop folders that ended up empty after filtering.
    if (count === 0) {
      out.splice(idx, 1);
    }
  }

  // Files at this level come after folders (so subfolders appear above same-level files).
  out.push(...fileEntries);

  return totalFiles;
}

export async function readFile(handle: FileSystemFileHandle): Promise<File> {
  return handle.getFile();
}
