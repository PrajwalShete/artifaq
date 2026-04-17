import type { ChangeEvent, KeyboardEvent } from 'react';
import { forwardRef } from 'react';
import { relativeTime } from '../lib/format.js';
import type { TreeNode } from '../lib/ipc.js';
import type { PinnedFolder, RecentFile, SlotMap } from '../lib/store.js';
import { type FileLikeNode, FolderTree } from './FolderTree.js';

interface Props {
  pinned: PinnedFolder[];
  activeId: string | null;
  recents: RecentFile[];
  nodes: TreeNode[];
  collapsed: Set<string>;
  filter: string;
  slots: SlotMap;
  selectedAbs: string | null;
  newAbs: Set<string>;
  publishingAbs: Set<string>;
  now: number;

  onPick(): void;
  onChooseFolder(id: string): void;
  onRemoveFolder(id: string): void;
  onToggleFolder(path: string): void;
  onSelectFile(file: FileLikeNode): void;
  onActionFile(file: FileLikeNode): void;
  onChooseRecent(r: RecentFile): void;
  onFilterChange(value: string): void;
}

export const Sidebar = forwardRef<HTMLInputElement, Props>(function Sidebar(p, filterRef) {
  const active = p.pinned.find((f) => f.id === p.activeId) ?? null;
  return (
    <aside className="sidebar">
      <div className="sidebar-actions">
        <button type="button" className="action-btn" onClick={p.onPick}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <title>Add folder</title>
            <path d="M2 5a1 1 0 011-1h3l1.5 1.5h5.5a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
            <path d="M8 7.5v3M6.5 9h3" strokeLinecap="round" />
          </svg>
          <span>Add folder</span>
        </button>
      </div>

      {p.pinned.length > 0 && (
        <section className="section">
          <div className="section-label">Folders</div>
          {p.pinned.map((f) => (
            <FolderItem
              key={f.id}
              folder={f}
              active={p.activeId === f.id}
              onPick={() => p.onChooseFolder(f.id)}
              onRemove={() => p.onRemoveFolder(f.id)}
            />
          ))}
        </section>
      )}

      {active && p.nodes.length > 0 && (
        <section className="section section-tree">
          <FilterInput
            ref={filterRef}
            value={p.filter}
            onChange={p.onFilterChange}
            placeholder={`filter ${active.name}`}
          />
          <FolderTree
            nodes={p.nodes}
            collapsed={p.collapsed}
            toggleFolder={p.onToggleFolder}
            filter={p.filter}
            slots={p.slots}
            selectedAbs={p.selectedAbs}
            newAbs={p.newAbs}
            publishingAbs={p.publishingAbs}
            onSelect={p.onSelectFile}
            onAction={p.onActionFile}
            now={p.now}
          />
        </section>
      )}

      {p.recents.length > 0 && (
        <section className="section">
          <div className="section-label">Recents</div>
          {p.recents.slice(0, 6).map((r) => (
            <button
              key={r.abs}
              type="button"
              className="recent-item"
              onClick={() => p.onChooseRecent(r)}
            >
              <span className="recent-name" title={r.abs}>
                {r.name}
              </span>
              <span className="recent-time">{relativeTime(Date.parse(r.openedAt), p.now)}</span>
            </button>
          ))}
        </section>
      )}
    </aside>
  );
});

interface FolderItemProps {
  folder: PinnedFolder;
  active: boolean;
  onPick(): void;
  onRemove(): void;
}

function FolderItem({ folder, active, onPick, onRemove }: FolderItemProps) {
  return (
    <div className={`folder-item${active ? ' active' : ''}`}>
      <button type="button" className="folder-pick" onClick={onPick} title={folder.abs}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <title>Folder</title>
          <path d="M2 5a1 1 0 011-1h3l1.5 1.5h5.5a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
        </svg>
        <span className="folder-name">{folder.name}</span>
      </button>
      <button
        type="button"
        className="folder-remove"
        onClick={onRemove}
        aria-label={`Remove ${folder.name}`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <title>Remove</title>
          <path d="M2 2l6 6M8 2L2 8" />
        </svg>
      </button>
    </div>
  );
}

interface FilterInputProps {
  value: string;
  onChange(v: string): void;
  placeholder: string;
}

const FilterInput = forwardRef<HTMLInputElement, FilterInputProps>(function FilterInput(
  { value, onChange, placeholder },
  ref,
) {
  return (
    <div className="filter">
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <title>Filter</title>
        <circle cx="7" cy="7" r="5" />
        <path d="M10.5 10.5l3 3" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="text"
        spellCheck={false}
        autoCorrect="off"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Escape') {
            onChange('');
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        aria-label="Filter files"
      />
    </div>
  );
});
