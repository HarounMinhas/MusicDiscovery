import { createTtlCache } from '../utils/ttlCache.js';
import { fetchJson, HttpStatusError, HttpTimeoutError } from '../utils/http.js';
import { getSmartRelatedConfig } from './smartRelatedConfig.js';
import type { DeezerArtist, DeezerSearchArtistResponse } from './types.js';
import { SmartRelatedError } from './errors.js';

const DEEZER_BASE_URL = 'https://api.deezer.com';

const caches = (() => {
  const ttl = getSmartRelatedConfig().cacheTtlMs;
  return {
    search: createTtlCache<DeezerArtist[]>(ttl),
    related: createTtlCache<DeezerArtist[]>(ttl)
  } as const;
})();

export interface SearchResult {
  artists: DeezerArtist[];
  cacheHit: boolean;
}

export interface RelatedResult {
  artists: DeezerArtist[];
  cacheHit: boolean;
}

export async function searchArtistByName(name: string): Promise<SearchResult> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return { artists: [], cacheHit: false };
  const cacheKey = normalized;
  const { value, hit } = await caches.search.getOrSet(cacheKey, async () => {
    try {
      const response = await fetchJson<DeezerSearchArtistResponse>(
        `${DEEZER_BASE_URL}/search/artist?q=${encodeURIComponent(name)}&limit=25`
      );
      return response.data ?? [];
    } catch (error) {
      throw mapError(error, { stage: 'deezer-search', query: name });
    }
  });
  return { artists: value, cacheHit: hit };
}

export async function getRelatedArtists(artistId: number, limit = 20): Promise<RelatedResult> {
  const cacheKey = `${artistId}:${limit}`;
  const { value, hit } = await caches.related.getOrSet(cacheKey, async () => {
    try {
      const response = await fetchJson<{ data: DeezerArtist[] }>(
        `${DEEZER_BASE_URL}/artist/${artistId}/related?limit=${limit}`
      );
      return response.data ?? [];
    } catch (error) {
      throw mapError(error, { stage: 'deezer-related', artistId });
    }
  });
  return { artists: value.slice(0, limit), cacheHit: hit };
}

export function pickBestDeezerArtist(query: string, candidates: DeezerArtist[]): DeezerArtist | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  let best: { artist: DeezerArtist; score: number } | null = null;
  for (const artist of candidates) {
    const score = computeArtistScore(normalized, artist);
    if (!best || score > best.score) {
      best = { artist, score };
    }
  }
  return best?.artist ?? null;
}

function computeArtistScore(query: string, artist: DeezerArtist): number {
  const name = artist.name?.trim().toLowerCase() ?? '';
  if (!name) return 0;
  let score = 0;
  if (name === query) {
    score = 5;
  } else if (name.startsWith(query) || query.startsWith(name)) {
    score = 3;
  } else {
    const similarity = 1 - levenshteinDistance(query, name) / Math.max(query.length, name.length, 1);
    score = similarity * 2;
  }
  const popularityBonus = (artist.nb_fan ?? 0) / 1_000_000;
  return score + popularityBonus;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function mapError(error: unknown, details: Record<string, unknown>): never {
  if (error instanceof HttpTimeoutError) {
    throw new SmartRelatedError('TIMEOUT', error.message, details);
  }
  if (error instanceof HttpStatusError) {
    throw new SmartRelatedError('UPSTREAM_ERROR', error.message, {
      ...details,
      status: error.status
    });
  }
  throw new SmartRelatedError('UPSTREAM_ERROR', 'Unexpected Deezer error', details, error instanceof Error ? error : undefined);
}

export function clearCaches() {
  caches.search.clear();
  caches.related.clear();
}
