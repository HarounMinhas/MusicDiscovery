import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastMessage {
  id: number;
  message: string;
}

interface ToastQueueOptions {
  maxVisible?: number;
  durationMs?: number;
}

export function useToastQueue(options: ToastQueueOptions = {}) {
  const { maxVisible = 3, durationMs = 4200 } = options;
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map<number, number>());

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (message: string) => {
      const text = message.trim();
      if (!text) {
        return;
      }

      setToasts((current) => {
        const id = ++idRef.current;
        const queue = [...current, { id, message: text }];
        const overflow = Math.max(0, queue.length - maxVisible);

        if (overflow > 0) {
          const removed = queue.slice(0, overflow);
          removed.forEach((toast) => {
            const timer = timersRef.current.get(toast.id);
            if (timer) {
              window.clearTimeout(timer);
              timersRef.current.delete(toast.id);
            }
          });
        }

        const next = queue.slice(-maxVisible);
        const timeout = window.setTimeout(() => removeToast(id), durationMs);
        timersRef.current.set(id, timeout);
        return next;
      });
    },
    [durationMs, maxVisible, removeToast]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return { toasts, pushToast, removeToast };
}
