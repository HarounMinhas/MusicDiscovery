import type { Artist, ProviderId, Track, ServiceMetadata } from '@musicdiscovery/shared';

export interface ArtistDetailsPayload {
  artist: Artist;
  topTracks: Track[];
  relatedArtists: Artist[];
  serviceMetadata?: ServiceMetadata;
}

interface CacheEntry {
  payload: ArtistDetailsPayload;
  timestamp: number;
}

const CACHE_TTL_MS = 1000 * 60 * 5;
const STALE_TTL_MS = 1000 * 60 * 60;

const cache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<ArtistDetailsPayload>>();

export function makeKey(provider: ProviderId, artistId: string): string {
  return `${provider}:${artistId}`;
}

export function getCached(key: string): ArtistDetailsPayload | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    return null;
  }
  return entry.payload;
}

export function getCachedStale(key: string): ArtistDetailsPayload | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > STALE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
}

export function setCached(key: string, payload: ArtistDetailsPayload): void {
  cache.set(key, { payload, timestamp: Date.now() });
}

export async function withInflight<T>(
  key: string,
  task: () => Promise<T>
): Promise<T> {
  const existing = inflightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = task();
  inflightRequests.set(key, promise as Promise<ArtistDetailsPayload>);

  try {
    const result = await promise;
    inflightRequests.delete(key);
    return result;
  } catch (error) {
    inflightRequests.delete(key);
    throw error;
  }
}
