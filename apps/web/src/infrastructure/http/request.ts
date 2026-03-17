import type { ProviderId } from '@musicdiscovery/shared';
import { NetworkError, ProviderError } from '../../domain/errors/AppErrors';
import { buildApiUrl } from '../../config/api';
import { getSelectedProvider } from '../../providerSelection';

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const COLD_START_RETRY_BUDGET_MS = 65_000;
const COLD_START_RETRY_BASE_DELAY_MS = 1200;
const COLD_START_RETRY_MAX_DELAY_MS = 10_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number): number {
  const exponentialDelay = Math.round(COLD_START_RETRY_BASE_DELAY_MS * Math.pow(1.8, Math.max(0, attempt - 1)));
  return Math.min(COLD_START_RETRY_MAX_DELAY_MS, exponentialDelay);
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

export async function request<T>(
  path: string,
  options: { includeProvider?: boolean; provider?: ProviderId } = {}
): Promise<T> {
  const url = new URL(path, 'http://placeholder.local');
  const provider = options.provider ?? getSelectedProvider();

  if (options.includeProvider !== false) {
    url.searchParams.set('provider', provider);
  }

  const requestUrl = buildApiUrl(`${url.pathname}${url.search}`);

  const startedAt = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    const attemptStartedAt = Date.now();
    console.info('API request started', { requestUrl, provider, attempt });
    try {
      response = await fetch(requestUrl, { cache: 'no-store' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network request failed';
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < COLD_START_RETRY_BUDGET_MS) {
        const delayMs = getRetryDelayMs(attempt);
        console.warn('API request network failure, retrying', { requestUrl, provider, attempt, message, elapsedMs, delayMs });
        await wait(delayMs);
        continue;
      }
      throw new NetworkError(`${message} (exceeded retry budget ${COLD_START_RETRY_BUDGET_MS}ms)`);
    }

    if (response.ok) {
      const elapsedMs = Date.now() - attemptStartedAt;
      console.info('API request succeeded', { requestUrl, provider, attempt, status: response.status, elapsedMs });
      return response.json() as Promise<T>;
    }

    const text = await response.text();
    const message = text || `Request failed: ${response.status}`;

    console.warn('API request failed', {
      requestUrl,
      provider,
      attempt,
      status: response.status,
      message
    });

    if (isRetryableStatus(response.status)) {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < COLD_START_RETRY_BUDGET_MS) {
        const delayMs = getRetryDelayMs(attempt);
        console.warn('API request returned retryable status, retrying', {
          requestUrl,
          provider,
          attempt,
          status: response.status,
          elapsedMs,
          delayMs
        });
        await wait(delayMs);
        continue;
      }
    }

    if (response.status >= 500) {
      throw new ProviderError(message, provider);
    }

    throw new NetworkError(message, response.status);
  }

  throw new NetworkError(`Request failed after exceeding retry budget (${COLD_START_RETRY_BUDGET_MS}ms)`);
}
