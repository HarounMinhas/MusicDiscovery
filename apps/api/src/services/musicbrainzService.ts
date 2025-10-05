import { createTtlCache } from '../utils/ttlCache.js';
import { fetchJson, HttpStatusError, HttpTimeoutError } from '../utils/http.js';
import { SmartRelatedError } from './errors.js';
import { getSmartRelatedConfig } from './smartRelatedConfig.js';
import type {
  MusicBrainzArtist,
  MusicBrainzArtistWithRelations,
  MusicBrainzSearchResponse
} from './types.js';

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const DEFAULT_SEARCH_LIMIT = 5;

let musicBrainzQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const caches = (() => {
  const ttl = getSmartRelatedConfig().cacheTtlMs;
  return {
    search: createTtlCache<MusicBrainzArtist | null>(ttl),
    group: createTtlCache<MusicBrainzArtistWithRelations | null>(ttl)
  } as const;
})();

export async function searchGroupByName(
  name: string
): Promise<{ artist: MusicBrainzArtist | null; cacheHit: boolean }> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return { artist: null, cacheHit: false };
  const cacheKey = normalized;
  const { value, hit } = await caches.search.getOrSet(cacheKey, async () => {
    const query = buildGroupSearchQuery(name);
    const url = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=${DEFAULT_SEARCH_LIMIT}`;
    try {
      const response = await requestMusicBrainz<MusicBrainzSearchResponse>(url);
      return pickBestGroup(name, response.artists ?? []);
    } catch (error) {
      throw mapError(error, { stage: 'musicbrainz-search', query: name });
    }
  });
  return { artist: value, cacheHit: hit };
}

export async function getGroupWithMemberRels(
  mbid: string
): Promise<{ group: MusicBrainzArtistWithRelations | null; cacheHit: boolean }> {
  const cacheKey = mbid;
  const { value, hit } = await caches.group.getOrSet(cacheKey, async () => {
    const url = `${MUSICBRAINZ_BASE_URL}/artist/${mbid}?inc=artist-rels&fmt=json`;
    try {
      return await requestMusicBrainz<MusicBrainzArtistWithRelations>(url);
    } catch (error) {
      throw mapError(error, { stage: 'musicbrainz-group', mbid });
    }
  });
  return { group: value, cacheHit: hit };
}

function pickBestGroup(query: string, groups: MusicBrainzArtist[]): MusicBrainzArtist | null {
  const normalized = query.trim().toLowerCase();
  let best: { artist: MusicBrainzArtist; score: number } | null = null;
  for (const artist of groups) {
    if (!artist || artist.type?.toLowerCase() !== 'group') continue;
    const name = artist.name?.trim().toLowerCase() ?? '';
    if (!name) continue;
    let score = artist.score ?? 0;
    if (name === normalized) score += 50;
    else if (name.startsWith(normalized) || normalized.startsWith(name)) score += 25;
    best = !best || score > best.score ? { artist, score } : best;
  }
  return best?.artist ?? null;
}

async function requestMusicBrainz<T>(url: string, attempt = 0): Promise<T> {
  return scheduleMusicBrainzRequest(async () => {
    try {
      return await fetchJson<T>(url, {
        headers: getMusicBrainzHeaders()
      });
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 503 && attempt < 3) {
        const backoff = Math.pow(2, attempt) * getSmartRelatedConfig().musicBrainzRateLimitMs;
        await delay(backoff);
        return requestMusicBrainz<T>(url, attempt + 1);
      }
      throw error;
    }
  });
}

function scheduleMusicBrainzRequest<T>(task: () => Promise<T>): Promise<T> {
  const runner = async () => {
    const config = getSmartRelatedConfig();
    const now = Date.now();
    const wait = Math.max(0, config.musicBrainzRateLimitMs - (now - lastRequestAt));
    if (wait > 0) {
      await delay(wait);
    }
    lastRequestAt = Date.now();
    return task();
  };

  const result = musicBrainzQueue.then(runner);
  musicBrainzQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function buildGroupSearchQuery(name: string): string {
  const escaped = name.replace(/"/g, '\\"');
  return `artist:"${escaped}" AND type:group`;
}

function getMusicBrainzHeaders(): Record<string, string> {
  const config = getSmartRelatedConfig();
  return {
    'User-Agent': config.musicBrainzUserAgent,
    Accept: 'application/json'
  };
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
  throw new SmartRelatedError(
    'UPSTREAM_ERROR',
    'Unexpected MusicBrainz error',
    details,
    error instanceof Error ? error : undefined
  );
}

export function clearCaches() {
  caches.search.clear();
  caches.group.clear();
}

function delay(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration));
}
