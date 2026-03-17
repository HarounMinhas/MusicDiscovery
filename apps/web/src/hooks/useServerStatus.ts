import { useCallback, useEffect, useRef, useState } from 'react';

import { buildApiUrl } from '../config/api';

type ServerStatus = 'checking' | 'starting' | 'ready';
export type ServerPhase = 'connecting' | 'booting';

const HEALTH_ENDPOINT = '/health';
const VISIBILITY_DELAY_MS = 600;
const WARMUP_ESTIMATE_MS = 60000;
const REQUEST_TIMEOUT_MS = 4000;
const HEALTH_CHECK_INTERVAL_MS = 5000;

async function fetchHealth(signal: AbortSignal): Promise<void> {
  const res = await fetch(buildApiUrl(HEALTH_ENDPOINT), {
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
    } catch (error) {
      console.warn('Server health check failed', { attempt: nextAttempt, error });
      setStatus('starting');
      timerRef.current = window.setTimeout(runCheck, HEALTH_CHECK_INTERVAL_MS);
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
