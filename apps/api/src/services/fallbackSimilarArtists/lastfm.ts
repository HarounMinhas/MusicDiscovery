import type { Logger } from 'pino';
import { env } from '../../env.js';
import { fetchJson, HttpStatusError, HttpTimeoutError } from '../../utils/http.js';
import { normalizeArtistName } from './normalize.js';
import { ProviderRateLimitError, createProviderLimiter, withProviderRateLimit } from './rateLimit.js';
import type { FallbackSimilarArtist } from './types.js';
import { getFallbackCache, getTTLForProvider } from '../../fallbackCache.js';

const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// Conservative rate limit guard (avoid bursting + keep deterministic behavior).
const lastfmLimiter = createProviderLimiter('lastfm', () => 1000);

interface LastFmSimilarArtist {
  name?: string;
  match?: string | number;
}

interface LastFmSimilarArtistsResponse {
  similarartists?: {
    artist?: LastFmSimilarArtist[];
  };
  error?: number;
  message?: string;
}

export async function getSimilarArtistsFromLastFm(
  artistName: string,
  limit: number,
  log: Logger
): Promise<FallbackSimilarArtist[]> {
  const apiKey = env.LASTFM_API_KEY;
  if (!apiKey) {
    log.info('Last.fm fallback skipped: LASTFM_API_KEY not configured');
    return [];
  }

  const trimmed = artistName.trim();
  if (!trimmed) return [];

  const cache = await getFallbackCache();
  const cacheKey = `lastfm:similar:${normalizeArtistName(trimmed)}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as FallbackSimilarArtist[];
      log.info({ cacheKey }, 'Last.fm cache hit');
      return parsed;
    } catch {
      log.warn({ cacheKey }, 'Invalid cached Last.fm data; ignoring');
    }
  }

  try {
    const url = new URL(LASTFM_BASE_URL);
    url.searchParams.set('method', 'artist.getSimilar');
    url.searchParams.set('artist', trimmed);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 25)));
    url.searchParams.set('autocorrect', '1');

    const payload = await withProviderRateLimit('lastfm', lastfmLimiter, log, async () => {
      return await fetchJson<LastFmSimilarArtistsResponse>(url.toString(), {
        headers: { Accept: 'application/json' }
      });
    });

    if (payload.error) {
      log.warn({ error: payload.error, message: payload.message }, 'Last.fm responded with an error payload');
      return [];
    }

    const raw = payload.similarartists?.artist ?? [];

    const seen = new Set<string>();
    const results: FallbackSimilarArtist[] = [];

    for (const item of raw) {
      const name = String(item.name ?? '').trim();
      if (!name) continue;

      const normalizedName = normalizeArtistName(name);
      if (!normalizedName) continue;
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);

      const match = typeof item.match === 'string' ? Number(item.match) : (item.match ?? 0);
      const similarityScore = Number.isFinite(match) ? clamp01(match) : 0;

      results.push({
        name,
        normalizedName,
        similarityScore,
        confidenceScore: similarityScore,
        uxLabel: 'audio-similarity-based',
        source: 'lastfm'
      });

      if (results.length >= limit) break;
    }

    if (results.length > 0) {
      await cache.set(cacheKey, JSON.stringify(results), getTTLForProvider('lastfm'));
    }

    return results;
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return [];
    if (error instanceof HttpTimeoutError) {
      log.warn({ url: error.url }, 'Last.fm request timed out (swallowed)');
      return [];
    }
    if (error instanceof HttpStatusError) {
      log.warn({ url: error.url, status: error.status }, 'Last.fm request failed (swallowed)');
      return [];
    }
    log.warn({ err: error }, 'Last.fm request crashed (swallowed)');
    return [];
  }
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
