import { useEffect } from 'react';

interface Props {
  onClose(): void;
}

export function KeyboardHelp({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        onClose();
      }
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
            <span className="kbd">j</span> <span className="kbd">k</span>
          </dt>
          <dd>Move between files</dd>
          <dt>
            <span className="kbd">space</span>
          </dt>
          <dd>Preview / hide preview</dd>
          <dt>
            <span className="kbd">↵</span>
          </dt>
          <dd>Publish (or re-copy if live)</dd>
          <dt>
            <span className="kbd">⌘C</span>
          </dt>
          <dd>Copy URL of focused live row</dd>
          <dt>
            <span className="kbd">/</span>
          </dt>
          <dd>Filter</dd>
          <dt>
            <span className="kbd">esc</span>
          </dt>
          <dd>Clear filter / close</dd>
          <dt>
            <span className="kbd">?</span>
          </dt>
          <dd>Toggle this help</dd>
        </dl>
      </div>
    </button>
  );
}
