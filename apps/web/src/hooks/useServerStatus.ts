import { useCallback, useEffect, useRef, useState } from 'react';

type ServerStatus = 'checking' | 'starting' | 'ready';
export type ServerPhase = 'connecting' | 'booting';

const HEALTH_ENDPOINT = '/health';
const VISIBILITY_DELAY_MS = 600;
const WARMUP_ESTIMATE_MS = 45000;
const REQUEST_TIMEOUT_MS = 4000;
const BACKOFF_BASE_MS = 1200;
const BACKOFF_MAX_MS = 8000;

function getApiPrefix(): string {
  const prefix = (import.meta.env.VITE_API_PREFIX ?? '/api').replace(/\/$/, '');
  return prefix || '/api';
}

async function fetchHealth(signal: AbortSignal): Promise<void> {
  const apiPrefix = getApiPrefix();
  const res = await fetch(`${apiPrefix}${HEALTH_ENDPOINT}`, {
    signal,
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`health-check:${res.status}`);
  }
  const data = (await res.json()) as { status?: string };
  if (data.status !== 'ok') {
    throw new Error('health-check:unhealthy');
  }
}

export function useServerStatus(): {
  status: ServerStatus;
  phase: ServerPhase;
  progress: number;
  visible: boolean;
  attempt: number;
  retryNow: () => void;
} {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [attempt, setAttempt] = useState(0);
  const startRef = useRef(Date.now());
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [now, setNow] = useState(Date.now());

  const runCheck = useCallback(async () => {
    attemptRef.current += 1;
    const nextAttempt = attemptRef.current;
    setAttempt(nextAttempt);
    setStatus(nextAttempt > 1 ? 'starting' : 'checking');

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      await fetchHealth(controller.signal);
      setStatus('ready');
    } catch {
      setStatus('starting');
      const delay = Math.min(
        BACKOFF_MAX_MS,
        Math.round(BACKOFF_BASE_MS * Math.pow(1.6, Math.max(0, nextAttempt - 1)))
      );
      timerRef.current = window.setTimeout(runCheck, delay);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    runCheck();
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, [runCheck]);

  useEffect(() => {
    if (status === 'ready') {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const retryNow = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    abortRef.current?.abort();
    startRef.current = Date.now();
    attemptRef.current = 0;
    setAttempt(0);
    setStatus('checking');
    runCheck();
  }, [runCheck]);

  const elapsedMs = now - startRef.current;
  const progress =
    status === 'ready'
      ? 100
      : Math.min(95, Math.max(0, Math.round((elapsedMs / WARMUP_ESTIMATE_MS) * 100)));
  const phase: ServerPhase = attempt <= 1 ? 'connecting' : 'booting';
  const visible = status !== 'ready' && elapsedMs > VISIBILITY_DELAY_MS;

  return { status, phase, progress, visible, attempt, retryNow };
}
