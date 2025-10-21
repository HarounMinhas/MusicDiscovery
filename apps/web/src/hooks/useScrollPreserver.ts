import { useCallback, useEffect, useRef } from 'react';

interface ScrollSnapshot {
  x: number;
  y: number;
}

export function useScrollPreserver() {
  const snapshotRef = useRef<ScrollSnapshot | null>(null);
  const rafRef = useRef<number | null>(null);

  const restore = useCallback(() => {
    if (typeof window === 'undefined') {
      snapshotRef.current = null;
      return;
    }

    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    if (!snapshot) {
      return;
    }

    const { x, y } = snapshot;
    if (window.scrollX !== x || window.scrollY !== y) {
      window.scrollTo(x, y);
    }
  }, []);

  const scheduleRestore = useCallback(() => {
    if (typeof window === 'undefined') {
      snapshotRef.current = null;
      return;
    }

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      restore();
    });
  }, [restore]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return useCallback(
    (operation: () => void) => {
      if (typeof window === 'undefined') {
        operation();
        return;
      }

      snapshotRef.current = { x: window.scrollX, y: window.scrollY };
      operation();
      scheduleRestore();
    },
    [scheduleRestore]
  );
}

export type PreserveScroll = ReturnType<typeof useScrollPreserver>;
