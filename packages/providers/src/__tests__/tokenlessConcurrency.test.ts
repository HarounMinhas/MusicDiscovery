import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('TokenlessProvider concurrency', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('limits concurrent requests when fetching by genre', async () => {
    const pending = new Set<symbol>();
    let peak = 0;

    vi.useFakeTimers();
    const httpModule = await import('../httpClient.js');
    const httpGetJsonSpy = vi.spyOn(httpModule, 'httpGetJson').mockImplementation(async () => {
      const marker = Symbol('request');
      pending.add(marker);
      peak = Math.max(peak, pending.size);

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          pending.delete(marker);
          resolve();
        }, 5);
      });

      return { results: [] };
    });

    const { TokenlessProvider } = await import('../tokenless/index.js');
    const provider = new TokenlessProvider({ concurrency: 2 });

    const artist: any = {
      id: 'itunes:artist:123',
      name: 'Test Artist',
      genres: ['Rock', 'Pop', 'Jazz', 'Blues']
    };

    const promise = (provider as any).lookupItunesArtistsByGenres(artist, 8);

    await vi.advanceTimersByTimeAsync(50);
    await promise;

    expect(httpGetJsonSpy).toHaveBeenCalledTimes(4);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
