import type { Logger } from 'pino';
import { fetchJson, HttpStatusError, HttpTimeoutError } from '../../utils/http.js';
import { getSmartRelatedConfig } from '../smartRelatedConfig.js';
import { normalizeArtistName } from './normalize.js';
import { ProviderRateLimitError, createProviderLimiter, withProviderRateLimit } from './rateLimit.js';
import type { FallbackSimilarArtist } from './types.js';
import { getFallbackCache, getTTLForProvider } from '../../fallbackCache.js';

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';

const musicBrainzLimiter = createProviderLimiter('musicbrainz', () => getSmartRelatedConfig().musicBrainzRateLimitMs);

interface MusicBrainzSearchArtist {
  id: string;
  name?: string;
  country?: string;
  score?: number;
}

interface MusicBrainzSearchResponse {
  artists?: MusicBrainzSearchArtist[];
}

interface MusicBrainzTag {
  name?: string;
  count?: number;
}

interface MusicBrainzArtistRelation {
  type?: string;
  artist?: { id: string; name?: string; country?: string };
}

interface MusicBrainzArtistDetails {
  id: string;
  name?: string;
  country?: string;
  tags?: MusicBrainzTag[];
  relations?: MusicBrainzArtistRelation[];
}

export async function getSimilarArtistsFromMusicBrainz(
  artistName: string,
  limit: number,
  log: Logger
): Promise<FallbackSimilarArtist[]> {
  const trimmed = artistName.trim();
  if (!trimmed) return [];

  const cache = await getFallbackCache();
  const cacheKey = `musicbrainz:similar:${normalizeArtistName(trimmed)}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as FallbackSimilarArtist[];
      log.info({ cacheKey }, 'MusicBrainz cache hit');
      return parsed;
    } catch {
      log.warn({ cacheKey }, 'Invalid cached MusicBrainz data; ignoring');
    }
  }

  try {
    const seed = await searchBestArtist(trimmed, log);
    if (!seed) return [];

    const seedDetails = await getArtistDetails(seed.id, log);
    if (!seedDetails) return [];

    const seedCountry = String(seedDetails.country ?? seed.country ?? '').trim().toUpperCase();

    const candidates = new Map<
      string,
      {
        name: string;
        normalizedName: string;
        relationSignal: number;
        tagSignal: number;
        countrySignal: number;
      }
    >();

    // Signal A: artist relations / collaborations
    for (const rel of seedDetails.relations ?? []) {
      const relatedName = String(rel.artist?.name ?? '').trim();
      if (!relatedName) continue;

      const normalizedName = normalizeArtistName(relatedName);
      if (!normalizedName) continue;

      const relationWeight = relationWeightForType(rel.type);
      const countryWeight = countryMatchWeight(seedCountry, rel.artist?.country);

      upsertCandidate(candidates, normalizedName, {
        name: relatedName,
        normalizedName,
        relationSignal: relationWeight,
        tagSignal: 0,
        countrySignal: countryWeight
      });
    }

    // Signal B: tags (if available)
    const tags = (seedDetails.tags ?? [])
      .map((tag) => ({
        name: String(tag.name ?? '').trim(),
        count: typeof tag.count === 'number' ? tag.count : Number(tag.count ?? 0)
      }))
      .filter((t) => t.name)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 3);

    const seedKey = normalizeArtistName(seedDetails.name ?? seed.name ?? trimmed);

    for (const tag of tags) {
      const tagResults = await searchArtistsByTag(tag.name, log);
      for (const artist of tagResults) {
        const name = String(artist.name ?? '').trim();
        if (!name) continue;
        const normalizedName = normalizeArtistName(name);
        if (!normalizedName || normalizedName === seedKey) continue;

        const countryWeight = countryMatchWeight(seedCountry, artist.country);

        upsertCandidate(candidates, normalizedName, {
          name,
          normalizedName,
          relationSignal: 0,
          tagSignal: 0.5,
          countrySignal: countryWeight
        });
      }

      if (candidates.size >= limit * 3) break;
    }

    const scored = Array.from(candidates.values())
      .map((item) => {
        const similarityScore = clamp01(item.relationSignal + item.tagSignal + item.countrySignal);
        const signals = [item.relationSignal, item.tagSignal, item.countrySignal].filter((v) => v > 0).length;
        // Metadata-based results: soft confidence, based on number of signals.
        const confidenceScore = clamp01((signals / 3) * 0.75 + similarityScore * 0.25);
        return {
          name: item.name,
          normalizedName: item.normalizedName,
          similarityScore,
          confidenceScore,
          uxLabel: 'metadata-based',
          source: 'musicbrainz' as const
        } satisfies FallbackSimilarArtist;
      })
      .filter((item) => item.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, Math.min(Math.max(limit, 1), 25));

    if (scored.length > 0) {
      await cache.set(cacheKey, JSON.stringify(scored), getTTLForProvider('musicbrainz'));
    }

    return scored;
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return [];
    if (error instanceof HttpTimeoutError) {
      log.warn({ url: error.url }, 'MusicBrainz request timed out (swallowed)');
      return [];
    }
    if (error instanceof HttpStatusError) {
      log.warn({ url: error.url, status: error.status }, 'MusicBrainz request failed (swallowed)');
      return [];
    }
    log.warn({ err: error }, 'MusicBrainz fallback crashed (swallowed)');
    return [];
  }
}

async function searchBestArtist(query: string, log: Logger): Promise<MusicBrainzSearchArtist | null> {
  try {
    const escaped = query.replace(/"/g, '\\"');
    const url = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(`artist:"${escaped}"`)}&fmt=json&limit=5`;
    const response = await requestMusicBrainz<MusicBrainzSearchResponse>(url, log);
    const artists = response.artists ?? [];
    if (artists.length === 0) return null;

    const normalizedQuery = normalizeArtistName(query);

    let best: { item: MusicBrainzSearchArtist; score: number } | null = null;
    for (const artist of artists) {
      const name = String(artist.name ?? '').trim();
      if (!name) continue;
      const normalizedName = normalizeArtistName(name);

      let score = typeof artist.score === 'number' ? artist.score : Number(artist.score ?? 0);
      if (normalizedName === normalizedQuery) score += 50;
      else if (normalizedName.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedName)) score += 25;

      if (!best || score > best.score) best = { item: artist, score };
    }

    return best?.item ?? null;
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return null;
    log.warn({ err: error, query }, 'MusicBrainz search failed (swallowed)');
    return null;
  }
}

async function getArtistDetails(mbid: string, log: Logger): Promise<MusicBrainzArtistDetails | null> {
  try {
    const url = `${MUSICBRAINZ_BASE_URL}/artist/${encodeURIComponent(mbid)}?inc=tags+artist-rels&fmt=json`;
    return await requestMusicBrainz<MusicBrainzArtistDetails>(url, log);
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return null;
    log.warn({ err: error, mbid }, 'MusicBrainz artist lookup failed (swallowed)');
    return null;
  }
}

async function searchArtistsByTag(tagName: string, log: Logger): Promise<MusicBrainzSearchArtist[]> {
  try {
    const escaped = tagName.replace(/"/g, '\\"');
    const url = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(`tag:"${escaped}"`)}&fmt=json&limit=5`;
    const response = await requestMusicBrainz<MusicBrainzSearchResponse>(url, log);
    return response.artists ?? [];
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return [];
    log.warn({ err: error, tagName }, 'MusicBrainz tag search failed (swallowed)');
    return [];
  }
}

function upsertCandidate(
  bag: Map<string, { name: string; normalizedName: string; relationSignal: number; tagSignal: number; countrySignal: number }>,
  key: string,
  incoming: { name: string; normalizedName: string; relationSignal: number; tagSignal: number; countrySignal: number }
) {
  const existing = bag.get(key);
  if (!existing) {
    bag.set(key, { ...incoming });
    return;
  }
  // Keep strongest signal contributions.
  existing.name = incoming.name || existing.name;
  existing.relationSignal = Math.max(existing.relationSignal, incoming.relationSignal);
  existing.tagSignal = Math.max(existing.tagSignal, incoming.tagSignal);
  existing.countrySignal = Math.max(existing.countrySignal, incoming.countrySignal);
}

function relationWeightForType(type: string | undefined): number {
  const normalized = String(type ?? '').trim().toLowerCase();
  if (!normalized) return 0.55;

  // Treat explicit collab-like relations as stronger signals.
  const strong = new Set([
    'collaboration',
    'collaborator',
    'supporting musician',
    'member of band',
    'instrument',
    'vocal'
  ]);
  return strong.has(normalized) ? 0.75 : 0.55;
}

function countryMatchWeight(seedCountry: string, candidateCountry: string | undefined): number {
  const candidate = String(candidateCountry ?? '').trim().toUpperCase();
  if (!seedCountry || !candidate) return 0;
  return seedCountry === candidate ? 0.1 : 0;
}

async function requestMusicBrainz<T>(url: string, log: Logger): Promise<T> {
  return await withProviderRateLimit('musicbrainz', musicBrainzLimiter, log, async () => {
    return await fetchJson<T>(url, { headers: getHeaders() });
  });
}

function getHeaders(): Record<string, string> {
  const config = getSmartRelatedConfig();
  return {
    'User-Agent': config.musicBrainzUserAgent,
    Accept: 'application/json'
  };
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
