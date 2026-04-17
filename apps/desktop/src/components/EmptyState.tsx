interface Props {
  onPick(): void;
}

export function EmptyState({ onPick }: Props) {
  return (
    <div className="empty">
      <h1>Point at a folder.</h1>
      <p>
        Artifaq lists every <code>.html</code> file inside — including in subfolders — and turns the
        ones you select into stable shareable URLs.
      </p>
      <button type="button" className="primary-btn" onClick={onPick}>
        Pick a folder
      </button>
      <p className="hint">⌘O · also works by dragging a folder onto the dock icon.</p>
    </div>
  );
}
