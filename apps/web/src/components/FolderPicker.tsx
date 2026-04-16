interface Props {
  onPick: () => void;
  hasStoredHandle: boolean;
}

export function FolderPicker({ onPick, hasStoredHandle }: Props) {
  return (
    <div className="center">
      <h1>Point at a folder.</h1>
      <p>
        We'll list every <code>.html</code> file inside it — including the ones in subfolders.
        Nothing leaves your machine until you press <strong>publish</strong>.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="primary-btn" onClick={onPick}>
          {hasStoredHandle ? 'Reconnect folder' : 'Pick a folder'}
        </button>
      </div>
      <div className="browser-hint">
        Tip: pick the parent of your AI projects — artifaq walks subfolders for you.
      </div>
    </div>
  );
}
