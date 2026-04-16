import { Fragment, type RefObject, useMemo } from 'react';
import { relativeTime } from '../lib/format.js';
import type { SlotMapping } from '../lib/handle-store.js';
import type { TreeFile, TreeFolder, TreeNode } from '../lib/walk.js';
import { Preview } from './Preview.js';

export type Status = 'untouched' | 'new' | 'draft' | 'live';

export interface RowState {
  status: Status;
  publishing?: boolean;
  livenessStale?: boolean;
}

interface Props {
  nodes: TreeNode[];
  collapsed: Set<string>;
  toggleFolder(path: string): void;
  filter: string;
  rowState(path: string): RowState;
  mappings: Record<string, SlotMapping>;
  focusedPath: string | null;
  setFocused(path: string | null): void;
  previewPath: string | null;
  setPreview(path: string | null): void;
  publish(file: TreeFile): void;
  copyLink(url: string): void;
  rowRefs: RefObject<Map<string, HTMLDivElement>>;
  now: number;
}

export function FileTree(props: Props) {
  const visible = useVisible(props.nodes, props.collapsed, props.filter);
  return (
    <div className="tree" role="tree">
      {visible.map((node) =>
        node.kind === 'folder' ? (
          <FolderRow
            key={`f:${node.path}`}
            node={node}
            collapsed={props.collapsed.has(node.path)}
            onToggle={() => props.toggleFolder(node.path)}
          />
        ) : (
          <Fragment key={`x:${node.path}`}>
            <FileRow
              file={node}
              state={props.rowState(node.path)}
              mapping={props.mappings[node.path]}
              focused={props.focusedPath === node.path}
              onFocus={() => props.setFocused(node.path)}
              onTogglePreview={() =>
                props.setPreview(props.previewPath === node.path ? null : node.path)
              }
              onAction={() => {
                const m = props.mappings[node.path];
                const live = props.rowState(node.path).status === 'live';
                if (live && m) props.copyLink(m.url);
                else props.publish(node);
              }}
              now={props.now}
              elemRef={(el) => {
                if (!props.rowRefs.current) return;
                if (el) props.rowRefs.current.set(node.path, el);
                else props.rowRefs.current.delete(node.path);
              }}
            />
            {props.previewPath === node.path ? (
              <Preview handle={node.handle} cacheKey={`${node.path}:${node.lastModified}`} />
            ) : null}
          </Fragment>
        ),
      )}
    </div>
  );
}

interface FolderProps {
  node: TreeFolder;
  collapsed: boolean;
  onToggle(): void;
}

function FolderRow({ node, collapsed, onToggle }: FolderProps) {
  return (
    <div
      className={`t-folder${collapsed ? ' collapsed' : ''}`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      role="treeitem"
      aria-expanded={!collapsed}
      tabIndex={-1}
    >
      <span className="chev" aria-hidden="true">
        ▾
      </span>
      <span className="t-name">{node.name === '' ? '(root)' : node.name}</span>
      <span className="t-count">{node.count}</span>
    </div>
  );
}

interface FileRowProps {
  file: TreeFile;
  state: RowState;
  mapping: SlotMapping | undefined;
  focused: boolean;
  onFocus(): void;
  onTogglePreview(): void;
  onAction(): void;
  now: number;
  elemRef: (el: HTMLDivElement | null) => void;
}

function FileRow(p: FileRowProps) {
  const { state, mapping, file } = p;
  const live = state.status === 'live';
  const isPublishable = !live;
  const actionLabel = live ? 'copy' : 'publish';

  return (
    <div
      ref={p.elemRef}
      role="treeitem"
      tabIndex={p.focused ? 0 : -1}
      className={`t-file${state.status === 'new' ? ' fresh' : ''}${
        p.focused ? ' focused' : ''
      }${state.publishing ? ' publishing' : ''}`}
      onClick={(e) => {
        // Avoid focus-flicker when clicking the action button.
        if ((e.target as HTMLElement).closest('button.t-action')) return;
        p.onFocus();
        p.onTogglePreview();
      }}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          p.onTogglePreview();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          p.onAction();
        }
      }}
    >
      <span className="t-indent" aria-hidden="true" />
      <span
        className={`t-dot ${state.status}${state.livenessStale ? ' stale' : ''}`}
        aria-hidden="true"
      />
      <span className="t-fname" title={file.path}>
        {file.name}
      </span>
      <span className="t-time">{relativeTime(file.lastModified, p.now)}</span>
      <button
        type="button"
        className={`t-action${isPublishable ? ' publishable' : ' always'}`}
        onClick={(e) => {
          e.stopPropagation();
          p.onAction();
        }}
        aria-label={`${actionLabel} ${file.name}`}
      >
        {state.publishing ? '…' : actionLabel}
      </button>
      <span style={{ display: 'none' }}>{mapping?.slotId}</span>
    </div>
  );
}

function useVisible(nodes: TreeNode[], collapsed: Set<string>, filter: string): TreeNode[] {
  return useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q && collapsed.size === 0) return nodes;

    const out: TreeNode[] = [];
    const hidden = new Set<string>();

    // First pass: figure out which folders are hidden by collapse.
    const fileMatches = (n: TreeFile) =>
      !q || n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q);

    for (const n of nodes) {
      if (n.kind === 'folder') {
        const ancestorHidden = isAncestorHidden(n.path, hidden);
        if (ancestorHidden) {
          hidden.add(n.path);
          continue;
        }
        if (collapsed.has(n.path)) hidden.add(n.path);
      }
    }

    for (const n of nodes) {
      if (n.kind === 'folder') {
        const ancestorHidden = isAncestorHidden(n.path, hidden);
        if (ancestorHidden) continue;
        // Hide folders with no visible descendants under current filter.
        if (q) {
          const hasMatch = nodes.some(
            (m) =>
              m.kind === 'file' &&
              (m.path === n.path || m.path.startsWith(`${n.path}/`)) &&
              fileMatches(m),
          );
          if (!hasMatch) continue;
        }
        out.push(n);
      } else {
        if (isAncestorHidden(n.path, hidden)) continue;
        if (q && !fileMatches(n)) continue;
        out.push(n);
      }
    }
    return out;
  }, [nodes, collapsed, filter]);
}

function isAncestorHidden(path: string, hidden: Set<string>): boolean {
  if (hidden.size === 0) return false;
  let i = path.lastIndexOf('/');
  while (i >= 0) {
    const parent = path.slice(0, i);
    if (hidden.has(parent)) return true;
    i = parent.lastIndexOf('/');
  }
  return hidden.has(''); // root-level container
}
