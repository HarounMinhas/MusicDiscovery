import { useCallback, useEffect, useRef, useState } from 'react';

import { buildApiUrl } from '../config/api';

type ServerStatus = 'checking' | 'starting' | 'ready';
export type ServerPhase = 'connecting' | 'booting';

const HEALTH_ENDPOINT = '/health';
const VISIBILITY_DELAY_MS = 600;
const WARMUP_ESTIMATE_MS = 60000;
const REQUEST_TIMEOUT_MS = 15000;
const HEALTH_CHECK_INTERVAL_MS = 5000;
const HEALTH_CHECK_RETRY_BUDGET_MS = 120000;

async function fetchHealth(signal: AbortSignal): Promise<void> {
  const healthUrl = buildApiUrl(HEALTH_ENDPOINT);
  const startedAt = Date.now();
  console.info('Health check started', { healthUrl });

  const res = await fetch(healthUrl, {
    signal,
    cache: 'no-store'
  });

  const elapsedMs = Date.now() - startedAt;
  let responsePayload: unknown = null;
  try {
    responsePayload = await res.clone().json();
  } catch {
    responsePayload = await res.clone().text().catch(() => null);
  }

  console.info('Health check response received', {
    healthUrl,
    status: res.status,
    ok: res.ok,
    elapsedMs,
    responsePayload
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
  const firstCheckStartedAtRef = useRef(Date.now());
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
      console.info('Health check marked server as ready', { attempt: nextAttempt });
      setStatus('ready');
    } catch (error) {
      const elapsedSinceFirstAttempt = Date.now() - firstCheckStartedAtRef.current;
      console.warn('Server health check failed', {
        attempt: nextAttempt,
        elapsedSinceFirstAttempt,
        retryBudgetMs: HEALTH_CHECK_RETRY_BUDGET_MS,
        error
      });
      setStatus('starting');
      if (elapsedSinceFirstAttempt < HEALTH_CHECK_RETRY_BUDGET_MS) {
        timerRef.current = window.setTimeout(runCheck, HEALTH_CHECK_INTERVAL_MS);
      } else {
        console.error('Health check retry budget exceeded; keeping app interactive with manual retry option', {
          attempt: nextAttempt,
          elapsedSinceFirstAttempt
        });
      }
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
    firstCheckStartedAtRef.current = Date.now();
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
