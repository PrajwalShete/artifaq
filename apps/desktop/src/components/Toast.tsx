import { useEffect } from 'react';
import type { ToastItem } from '../hooks/useToast.js';

interface HostProps {
  items: ToastItem[];
  dismiss(id: string): void;
}

export function ToastHost({ items, dismiss }: HostProps) {
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <Toast key={t.id} item={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

function Toast({ item, dismiss }: { item: ToastItem; dismiss(id: string): void }) {
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.duration ?? 3000);
    return () => clearTimeout(t);
  }, [item.id, item.duration, dismiss]);
  return (
    <div className={`toast${item.kind === 'error' ? ' error' : ''}`}>
      <span className="toast-dot" />
      <span className="toast-text">{item.text}</span>
    </div>
  );
}
