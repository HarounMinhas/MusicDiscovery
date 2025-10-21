import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpRequestError, httpGet, httpGetJson } from '../httpClient.js';

const originalFetch = global.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('httpClient', () => {
  it('applies default headers to requests', async () => {
    const response = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const fetchSpy = vi.fn().mockResolvedValue(response);
    global.fetch = fetchSpy;

    const result = await httpGet('https://example.com/api');

    expect(result).toBe(response);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': 'MusicDiscovery/1.0' })
      })
    );
  });

  it('rejects when the request times out', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_url, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const request = httpGet('https://example.com/slow', { timeoutMs: 100 });

    vi.advanceTimersByTime(100);

    await expect(request).rejects.toHaveProperty('name', 'AbortError');
  });

  it('retries when the request fails with a network error', async () => {
    const response = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValue(response);

    global.fetch = fetchSpy;

    const result = await httpGet('https://example.com/retry', { retry: 1 });

    expect(result).toBe(response);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx responses', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    global.fetch = fetchSpy;

    await expect(httpGet('https://example.com/not-found', { retry: 2 })).rejects.toBeInstanceOf(HttpRequestError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('parses JSON responses', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{"value":42}', { status: 200 }));
    global.fetch = fetchSpy;

    const result = await httpGetJson<{ value: number }>('https://example.com/json');

    expect(result).toEqual({ value: 42 });
  });
});
