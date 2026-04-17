import { useMemo } from 'react';
import { relativeTime } from '../lib/format.js';
import type { TreeNode } from '../lib/ipc.js';
import type { SlotMap } from '../lib/store.js';

interface FileLikeNode {
  kind: 'file';
  name: string;
  path: string;
  parent: string;
  depth: number;
  abs: string;
  size: number;
  modified_ms: number;
}

interface Props {
  nodes: TreeNode[];
  collapsed: Set<string>;
  toggleFolder(path: string): void;
  filter: string;
  slots: SlotMap;
  selectedAbs: string | null;
  newAbs: Set<string>;
  publishingAbs: Set<string>;
  onSelect(file: FileLikeNode): void;
  onAction(file: FileLikeNode): void;
  now: number;
}

export function FolderTree(p: Props) {
  const visible = useVisible(p.nodes, p.collapsed, p.filter);
  return (
    <div className="tree" role="tree">
      {visible.map((node) => {
        if (node.kind === 'folder') {
          return (
            <FolderRow
              key={`f:${node.path}`}
              name={node.name}
              path={node.path}
              depth={node.depth}
              collapsed={p.collapsed.has(node.path)}
              onToggle={() => p.toggleFolder(node.path)}
            />
          );
        }
        const slot = p.slots[node.abs];
        const isLive = !!slot;
        const isNew = p.newAbs.has(node.abs);
        const isPublishing = p.publishingAbs.has(node.abs);
        const isStale = isLive && slot && node.modified_ms > Date.parse(slot.updatedAt);
        const status: Status = isLive
          ? 'live'
          : isPublishing
            ? 'draft'
            : isNew
              ? 'new'
              : 'untouched';

        return (
          <FileRow
            key={`x:${node.abs}`}
            file={node}
            depth={node.depth}
            status={status}
            stale={!!isStale}
            selected={p.selectedAbs === node.abs}
            actionLabel={isLive ? 'copy' : 'publish'}
            publishing={isPublishing}
            onClick={() => p.onSelect(node)}
            onAction={() => p.onAction(node)}
            now={p.now}
          />
        );
      })}
    </div>
  );
}

type Status = 'untouched' | 'new' | 'draft' | 'live';

interface FolderRowProps {
  name: string;
  path: string;
  depth: number;
  collapsed: boolean;
  onToggle(): void;
}

function FolderRow({ name, depth, collapsed, onToggle }: FolderRowProps) {
  return (
    <button
      type="button"
      className={`t-folder${collapsed ? ' collapsed' : ''}`}
      style={{ paddingLeft: 8 + (depth - 1) * 14 }}
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <span className="chev" aria-hidden="true">
        ▾
      </span>
      <span className="t-name">{name === '' ? '(root)' : name}</span>
    </button>
  );
}

interface FileRowProps {
  file: FileLikeNode;
  depth: number;
  status: Status;
  stale: boolean;
  selected: boolean;
  actionLabel: string;
  publishing: boolean;
  onClick(): void;
  onAction(): void;
  now: number;
}

function FileRow(p: FileRowProps) {
  return (
    <div
      role="treeitem"
      aria-selected={p.selected}
      tabIndex={p.selected ? 0 : -1}
      className={`t-file${p.selected ? ' selected' : ''}${p.status === 'new' ? ' fresh' : ''}`}
      style={{ paddingLeft: 8 + p.depth * 14 }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button.t-action')) return;
        p.onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          p.onAction();
        }
      }}
    >
      <span className={`t-dot ${p.status}${p.stale ? ' stale' : ''}`} aria-hidden="true" />
      <span className="t-fname" title={p.file.path}>
        {p.file.name}
      </span>
      <span className="t-time">{relativeTime(p.file.modified_ms, p.now)}</span>
      <button
        type="button"
        className={`t-action${p.status === 'live' ? ' always' : ' publishable'}`}
        onClick={(e) => {
          e.stopPropagation();
          p.onAction();
        }}
        aria-label={`${p.actionLabel} ${p.file.name}`}
      >
        {p.publishing ? '…' : p.actionLabel}
      </button>
    </div>
  );
}

function useVisible(nodes: TreeNode[], collapsed: Set<string>, filter: string): TreeNode[] {
  return useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q && collapsed.size === 0) return nodes;

    const hidden = new Set<string>();
    for (const n of nodes) {
      if (n.kind === 'folder' && (collapsed.has(n.path) || hasHiddenAncestor(n.path, hidden))) {
        hidden.add(n.path);
      }
    }

    return nodes.filter((n) => {
      const path = n.path;
      if (hasHiddenAncestor(path, hidden)) return false;
      if (!q) return true;
      if (n.kind === 'file') {
        return n.path.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
      }
      // Folders: keep if any descendant file matches
      return nodes.some(
        (m) =>
          m.kind === 'file' &&
          m.path.startsWith(`${n.path}/`) &&
          (m.path.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
      );
    });
  }, [nodes, collapsed, filter]);
}

function hasHiddenAncestor(path: string, hidden: Set<string>): boolean {
  if (hidden.size === 0) return false;
  let i = path.lastIndexOf('/');
  while (i >= 0) {
    const parent = path.slice(0, i);
    if (hidden.has(parent)) return true;
    i = parent.lastIndexOf('/');
  }
  return false;
}

export type { FileLikeNode };
