import { env } from '../env.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface FetchOptions extends RequestInit {
  retryOn429?: boolean;
  retryDelayMs?: number;
}

export class HttpTimeoutError extends Error {
  constructor(message: string, public readonly url: string) {
    super(message);
    this.name = 'HttpTimeoutError';
  }
}

export class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.HTTP_DEFAULT_TIMEOUT_MS);
  const signal = options.signal
    ? anySignal([options.signal as AbortSignal, controller.signal])
    : controller.signal;
  const retryOn429 = options.retryOn429 ?? true;
  const retryDelayMs = options.retryDelayMs ?? 750;
  try {
    const res = await fetch(url, { ...options, signal });
    if (res.status === 429 && retryOn429) {
      const delay = parseRetryAfter(res.headers.get('retry-after')) ?? retryDelayMs;
      await delayMs(delay);
      return fetchJson<T>(url, { ...options, retryOn429: false });
    }
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      throw new HttpStatusError(`Request to ${url} failed with status ${res.status}`, url, res.status, body);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new HttpTimeoutError(`Request to ${url} timed out`, url);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric * 1000;
  }
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
}

function delayMs(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}
