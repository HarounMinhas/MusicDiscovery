const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_USER_AGENT = 'MusicDiscovery/1.0';

export interface HttpRequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  retry?: number;
}

export class HttpRequestError extends Error {
  public readonly status: number;
  public readonly url: string;

  constructor(status: number, url: string) {
    super(`Request to ${url} failed with status ${status}`);
    this.name = 'HttpRequestError';
    this.status = status;
    this.url = url;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof HttpRequestError) {
    return error.status >= 500;
  }
  return true;
}

export async function httpGet(url: string, options: HttpRequestOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, retry = 0 } = options;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retry) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          ...headers
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new HttpRequestError(response.status, url);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retry || !shouldRetry(error)) {
        throw error;
      }

      const backoff = Math.min(250 * Math.pow(2, attempt), 1000);
      await delay(backoff);
    } finally {
      clearTimeout(timer);
    }

    attempt += 1;
  }

  throw lastError ?? new Error('Unknown HTTP error');
}

export async function httpGetJson<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
  const response = await httpGet(url, options);
  return (await response.json()) as T;
}
