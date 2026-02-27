import { beforeEach, describe, expect, test, vi } from 'vitest';
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
    relatedArtists: [createArtist(`${id}-related`)]
  };
}

async function loadCacheModule() {
  vi.resetModules();
  return import('../artistCache');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
});

describe('artistCache', () => {
  test('returns fresh data and identifies stale entries', async () => {
    const cache = await loadCacheModule();
    const key = cache.makeKey(PROVIDER, 'artist-1');
    cache.setCached(key, createPayload('artist-1'));

    expect(cache.getCached(key)).not.toBeNull();

    vi.advanceTimersByTime(1000 * 60 * 5 + 1000);

    expect(cache.getCached(key)).toBeNull();
    expect(cache.getCachedStale(key)?.artist.id).toBe('artist-1');
  });

  test('evicts stale entries after stale ttl passes', async () => {
    const cache = await loadCacheModule();
    const key = cache.makeKey(PROVIDER, 'artist-evict');
    cache.setCached(key, createPayload('artist-evict'));

    vi.advanceTimersByTime(1000 * 60 * 60 + 1000);

    expect(cache.getCachedStale(key)).toBeNull();
  });

  test('deduplicates in-flight promises', async () => {
    const cache = await loadCacheModule();
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
});
