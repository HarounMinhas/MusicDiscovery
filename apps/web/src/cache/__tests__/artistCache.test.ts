import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ArtistDetailsPayload } from '../artistCache';
import type { Artist, Track } from '@musicdiscovery/shared';

const PROVIDER = 'spotify';

function createArtist(id: string): Artist {
  return {
    id,
    name: `Artist ${id}`
  };
}

function createTrack(id: string): Track {
  return {
    id: `track-${id}`,
    name: `Track ${id}`,
    durationMs: 180000,
    previewUrl: undefined,
    artists: [{ id: `artist-${id}`, name: `Artist ${id}` }]
  };
}

function createPayload(id: string): ArtistDetailsPayload {
  return {
    artist: createArtist(id),
    topTracks: [createTrack(`${id}-1`), createTrack(`${id}-2`)],
    relatedArtists: [createArtist(`${id}-related`)],
    provider: PROVIDER,
    fetchedAt: Date.now()
  };
}

async function loadCacheModule() {
  vi.resetModules();
  return import('../artistCache');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('artistCache', () => {
  test('returns fresh data and identifies stale entries', async () => {
    const cache = await loadCacheModule();
    cache.clearAll();
    const key = cache.makeKey(PROVIDER, 'artist-1');
    cache.setCached(key, createPayload('artist-1'), cache.DEFAULT_TTL_MS);

    expect(cache.getCached(key)).not.toBeNull();

    vi.advanceTimersByTime(cache.DEFAULT_TTL_MS + 1000);

    expect(cache.getCached(key)).toBeNull();
    expect(cache.getCachedStale(key)?.artist.id).toBe('artist-1');
  });

  test('deduplicates in-flight promises', async () => {
    const cache = await loadCacheModule();
    cache.clearAll();
    const key = cache.makeKey(PROVIDER, 'artist-2');
    const payload = createPayload('artist-2');
    const factory = vi.fn(async () => payload);

    const [resultA, resultB] = await Promise.all([
      cache.withInflight(key, factory),
      cache.withInflight(key, factory)
    ]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(resultA).toEqual(payload);
    expect(resultB).toEqual(payload);
  });

  test('evicts least recently used entries when over capacity', async () => {
    const cache = await loadCacheModule();
    cache.clearAll();

    const firstKey = cache.makeKey(PROVIDER, 'artist-0');
    for (let index = 0; index < cache.MAX_ENTRIES; index += 1) {
      const key = cache.makeKey(PROVIDER, `artist-${index}`);
      cache.setCached(key, createPayload(`artist-${index}`));
      vi.advanceTimersByTime(1);
    }

    // Access a more recent key to ensure the first one is the oldest
    cache.getCachedStale(cache.makeKey(PROVIDER, `artist-${cache.MAX_ENTRIES - 1}`));

    const extraKey = cache.makeKey(PROVIDER, 'artist-extra');
    cache.setCached(extraKey, createPayload('artist-extra'));

    expect(cache.getCachedStale(firstKey)).toBeNull();
    expect(cache.getCachedStale(extraKey)).not.toBeNull();
  });

  test('clears persisted cache on schema version mismatch', async () => {
    const key = `${PROVIDER}:artist-persisted`;
    const stored: ArtistDetailsPayload = createPayload('persisted');
    const snapshot = {
      version: 999,
      entries: [
        {
          key,
          version: 999,
          ttlMs: 6 * 60 * 60 * 1000,
          value: stored,
          lastAccessedAt: Date.now()
        }
      ]
    };

    window.localStorage.setItem('artistDetailsCache.v1', JSON.stringify(snapshot));

    const cache = await loadCacheModule();

    expect(cache.getCachedStale(key)).toBeNull();
    expect(window.localStorage.getItem(cache.STORAGE_KEY)).toBeNull();
  });
});
