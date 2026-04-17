import { useEffect } from 'react';

interface Props {
  onClose(): void;
}

export function KeyboardHelp({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <button
      type="button"
      className="help-overlay"
      onClick={onClose}
      aria-label="Close keyboard help"
    >
      <div
        className="help-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>Keyboard</h3>
        <dl>
          <dt>
            <span className="kbd">⌘O</span>
          </dt>
          <dd>Open a folder</dd>
          <dt>
            <span className="kbd">⌘↵</span>
          </dt>
          <dd>Publish selected file</dd>
          <dt>
            <span className="kbd">⌘C</span>
          </dt>
          <dd>Copy URL of selected live file</dd>
          <dt>
            <span className="kbd">⌘F</span>
          </dt>
          <dd>Filter files</dd>
          <dt>
            <span className="kbd">⌘\\</span>
          </dt>
          <dd>Toggle sidebar</dd>
          <dt>
            <span className="kbd">?</span>
          </dt>
          <dd>Toggle this help</dd>
        </dl>
      </div>
    </button>
  );
}
