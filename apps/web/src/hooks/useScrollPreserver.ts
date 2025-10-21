import { useCallback, useEffect, useRef } from 'react';

interface ScrollSnapshot {
  x: number;
  y: number;
}

export function useScrollPreserver() {
  const snapshotRef = useRef<ScrollSnapshot | null>(null);
  const rafRef = useRef<number | null>(null);

  const scheduleRestore = useCallback(() => {
    if (typeof window === 'undefined') {
      snapshotRef.current = null;
      return;
    }

    const snapshot = snapshotRef.current;
    if (!snapshot) {
      return;
    }

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    const run = (remainingAttempts: number) => {
      if (typeof window === 'undefined') {
        snapshotRef.current = null;
        rafRef.current = null;
        return;
      }

      if (window.scrollX !== snapshot.x || window.scrollY !== snapshot.y) {
        window.scrollTo(snapshot.x, snapshot.y);
      }

      if (remainingAttempts > 0) {
        rafRef.current = window.requestAnimationFrame(() => run(remainingAttempts - 1));
      } else {
        rafRef.current = null;
        snapshotRef.current = null;
      }
    };

    rafRef.current = window.requestAnimationFrame(() => run(3));
  }, []);

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
