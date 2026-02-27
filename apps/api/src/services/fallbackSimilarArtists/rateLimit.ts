import type { Logger } from 'pino';

export class ProviderRateLimitError extends Error {
  readonly provider: string;

  constructor(provider: string, message = 'Provider rate-limited') {
    super(message);
    this.name = 'ProviderRateLimitError';
    this.provider = provider;
  }
}

interface ProviderLimiter {
  tryAcquire(): boolean;
  release(): void;
  getMinIntervalMs(): number;
}

export function createProviderLimiter(_provider: string, getMinIntervalMs: () => number): ProviderLimiter {
  let lastRequestAt = 0;
  let inFlight = false;

  return {
    tryAcquire() {
      const minIntervalMs = Math.max(0, getMinIntervalMs());
      const now = Date.now();

      if (inFlight) return false;

      const elapsed = now - lastRequestAt;
      if (elapsed < minIntervalMs) return false;

      inFlight = true;
      lastRequestAt = now;
      return true;
    },

    release() {
      inFlight = false;
    },

    getMinIntervalMs() {
      return Math.max(0, getMinIntervalMs());
    }
  };
}

export async function withProviderRateLimit<T>(
  provider: string,
  limiter: ProviderLimiter,
  log: Logger,
  task: () => Promise<T>
): Promise<T> {
  if (!limiter.tryAcquire()) {
    log.info(
      { provider, minIntervalMs: limiter.getMinIntervalMs() },
      'fallback provider rate-limited; skipping'
    );
    throw new ProviderRateLimitError(provider);
  }

  try {
    return await task();
  } finally {
    limiter.release();
  }
}
