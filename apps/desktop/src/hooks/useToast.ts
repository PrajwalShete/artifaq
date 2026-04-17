import { useCallback, useState } from 'react';

export interface ToastItem {
  id: string;
  kind: 'success' | 'error';
  text: string;
  duration?: number;
}

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { ...t, id }]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { items, push, dismiss };
}
