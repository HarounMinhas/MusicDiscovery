import type { Logger } from 'pino';
import { fetchJson, HttpStatusError, HttpTimeoutError } from '../../utils/http.js';
import { normalizeArtistName } from './normalize.js';
import { ProviderRateLimitError, createProviderLimiter, withProviderRateLimit } from './rateLimit.js';
import type { FallbackSimilarArtist } from './types.js';
import { getFallbackCache, getTTLForProvider } from '../../fallbackCache.js';

const DISCOGS_BASE_URL = 'https://api.discogs.com';
const DISCOGS_USER_AGENT = 'MusicDiscovery/1.0 (+https://harounminhas.github.io)';

const discogsLimiter = createProviderLimiter('discogs', () => 1100);

interface DiscogsSearchResult {
  id?: number;
  type?: string;
  title?: string;
  genre?: string[];
  style?: string[];
}

interface DiscogsSearchResponse {
  results?: DiscogsSearchResult[];
}

interface DiscogsArtistRelease {
  id?: number;
  type?: 'master' | 'release';
  title?: string;
  role?: string;
}

interface DiscogsArtistReleasesResponse {
  releases?: DiscogsArtistRelease[];
}

interface DiscogsLabel {
  name?: string;
}

interface DiscogsMasterDetails {
  id?: number;
  title?: string;
  genres?: string[];
  styles?: string[];
}

interface DiscogsReleaseDetails {
  id?: number;
  title?: string;
  genres?: string[];
  styles?: string[];
  labels?: DiscogsLabel[];
}

export async function getSimilarArtistsFromDiscogs(
  artistName: string,
  limit: number,
  log: Logger
): Promise<FallbackSimilarArtist[]> {
  const trimmed = artistName.trim();
  if (!trimmed) return [];

  const cache = await getFallbackCache();
  const cacheKey = `discogs:similar:${normalizeArtistName(trimmed)}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as FallbackSimilarArtist[];
      log.info({ cacheKey }, 'Discogs cache hit');
      return parsed;
    } catch {
      log.warn({ cacheKey }, 'Invalid cached Discogs data; ignoring');
    }
  }

  try {
    const seed = await searchBestArtist(trimmed, log);
    if (!seed?.id) return [];

    const releases = await getArtistReleases(seed.id, log);
    if (releases.length === 0) return [];

    const signature = await buildSceneSignature(releases, log);
    if (signature.labels.length === 0 && signature.styles.length === 0 && signature.genres.length === 0) {
      return [];
    }

    const candidates = new Map<string, { name: string; normalizedName: string; score: number; signals: number }>();

    // Label-based search (stronger)
    for (const label of signature.labels.slice(0, 2)) {
      const results = await searchReleasesByLabel(label, log);
      for (const item of results) {
        const candidateName = extractArtistFromTitle(item.title);
        if (!candidateName) continue;
        const normalizedName = normalizeArtistName(candidateName);
        if (!normalizedName) continue;

        addCandidate(candidates, normalizedName, candidateName, 0.6, 1);

        // If the release also shares a style/genre, give a small boost.
        if (hasOverlap(signature.styles, item.style)) addCandidate(candidates, normalizedName, candidateName, 0.15, 1);
        if (hasOverlap(signature.genres, item.genre)) addCandidate(candidates, normalizedName, candidateName, 0.1, 1);
      }

      if (candidates.size >= limit * 3) break;
    }

    // Style-based search
    for (const style of signature.styles.slice(0, 2)) {
      const results = await searchReleasesByStyle(style, log);
      for (const item of results) {
        const candidateName = extractArtistFromTitle(item.title);
        if (!candidateName) continue;
        const normalizedName = normalizeArtistName(candidateName);
        if (!normalizedName) continue;

        addCandidate(candidates, normalizedName, candidateName, 0.4, 1);
        if (hasOverlap(signature.genres, item.genre)) addCandidate(candidates, normalizedName, candidateName, 0.1, 1);
      }

      if (candidates.size >= limit * 3) break;
    }

    const seedKey = normalizeArtistName(seed.title ?? trimmed);

    const items = Array.from(candidates.values())
      .filter((c) => c.normalizedName !== seedKey)
      .map((c) => {
        const similarityScore = clamp01(c.score);
        const confidenceScore = clamp01(similarityScore * 0.7 + Math.min(1, c.signals / 3) * 0.3);
        return {
          name: c.name,
          normalizedName: c.normalizedName,
          similarityScore,
          confidenceScore,
          uxLabel: 'scene-based',
          source: 'discogs' as const
        } satisfies FallbackSimilarArtist;
      })
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, Math.min(Math.max(limit, 1), 25));

    if (items.length > 0) {
      await cache.set(cacheKey, JSON.stringify(items), getTTLForProvider('discogs'));
    }

    return items;
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return [];
    if (error instanceof HttpTimeoutError) {
      log.warn({ url: error.url }, 'Discogs request timed out (swallowed)');
      return [];
    }
    if (error instanceof HttpStatusError) {
      log.warn({ url: error.url, status: error.status }, 'Discogs request failed (swallowed)');
      return [];
    }
    log.warn({ err: error }, 'Discogs fallback crashed (swallowed)');
    return [];
  }
}

async function searchBestArtist(query: string, log: Logger): Promise<DiscogsSearchResult | null> {
  const url = `${DISCOGS_BASE_URL}/database/search?q=${encodeURIComponent(query)}&type=artist&per_page=5&page=1`;
  try {
    const response = await requestDiscogs<DiscogsSearchResponse>(url, log);
    const results = (response.results ?? []).filter((r) => String(r.type ?? '').toLowerCase() === 'artist');
    if (results.length === 0) return null;

    const normalizedQuery = normalizeArtistName(query);

    let best: { item: DiscogsSearchResult; score: number } | null = null;
    for (const item of results) {
      const title = String(item.title ?? '').trim();
      if (!title) continue;
      const normalizedTitle = normalizeArtistName(title);

      let score = 0;
      if (normalizedTitle === normalizedQuery) score += 2;
      else if (normalizedTitle.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedTitle)) score += 1;

      best = !best || score > best.score ? { item, score } : best;
    }

    return best?.item ?? results[0]!;
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return null;
    log.warn({ err: error, query }, 'Discogs artist search failed (swallowed)');
    return null;
  }
}

async function getArtistReleases(artistId: number, log: Logger): Promise<DiscogsArtistRelease[]> {
  const url = `${DISCOGS_BASE_URL}/artists/${artistId}/releases?sort=year&sort_order=desc&per_page=25&page=1`;
  try {
    const response = await requestDiscogs<DiscogsArtistReleasesResponse>(url, log);
    const releases = response.releases ?? [];

    // Prefer main artist appearances when possible.
    const main = releases.filter((r) => String(r.role ?? '').toLowerCase().includes('main'));
    const pick = main.length > 0 ? main : releases;

    return pick
      .filter((r) => !!r.id && (r.type === 'master' || r.type === 'release'))
      .slice(0, 8);
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return [];
    log.warn({ err: error, artistId }, 'Discogs artist releases lookup failed (swallowed)');
    return [];
  }
}

async function buildSceneSignature(releases: DiscogsArtistRelease[], log: Logger): Promise<{
  genres: string[];
  styles: string[];
  labels: string[];
}> {
  const genreCount = new Map<string, number>();
  const styleCount = new Map<string, number>();
  const labelCount = new Map<string, number>();

  // Limit detail calls.
  const sample = releases.slice(0, 3);

  for (const rel of sample) {
    const id = rel.id;
    if (!id) continue;

    if (rel.type === 'master') {
      const details = await getMasterDetails(id, log);
      for (const g of details?.genres ?? []) bump(genreCount, g);
      for (const s of details?.styles ?? []) bump(styleCount, s);
    } else {
      const details = await getReleaseDetails(id, log);
      for (const g of details?.genres ?? []) bump(genreCount, g);
      for (const s of details?.styles ?? []) bump(styleCount, s);
      for (const l of details?.labels ?? []) {
        const name = String(l.name ?? '').trim();
        if (name) bump(labelCount, name);
      }
    }
  }

  return {
    genres: topKeys(genreCount, 3),
    styles: topKeys(styleCount, 3),
    labels: topKeys(labelCount, 3)
  };
}

async function getMasterDetails(masterId: number, log: Logger): Promise<DiscogsMasterDetails | null> {
  const url = `${DISCOGS_BASE_URL}/masters/${masterId}`;
  try {
    return await requestDiscogs<DiscogsMasterDetails>(url, log);
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return null;
    log.warn({ err: error, masterId }, 'Discogs master lookup failed (swallowed)');
    return null;
  }
}

async function getReleaseDetails(releaseId: number, log: Logger): Promise<DiscogsReleaseDetails | null> {
  const url = `${DISCOGS_BASE_URL}/releases/${releaseId}`;
  try {
    return await requestDiscogs<DiscogsReleaseDetails>(url, log);
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return null;
    log.warn({ err: error, releaseId }, 'Discogs release lookup failed (swallowed)');
    return null;
  }
}

async function searchReleasesByLabel(label: string, log: Logger): Promise<DiscogsSearchResult[]> {
  const url = `${DISCOGS_BASE_URL}/database/search?type=release&label=${encodeURIComponent(label)}&per_page=10&page=1`;
  try {
    const response = await requestDiscogs<DiscogsSearchResponse>(url, log);
    return response.results ?? [];
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return [];
    log.warn({ err: error, label }, 'Discogs label search failed (swallowed)');
    return [];
  }
}

async function searchReleasesByStyle(style: string, log: Logger): Promise<DiscogsSearchResult[]> {
  const url = `${DISCOGS_BASE_URL}/database/search?type=release&style=${encodeURIComponent(style)}&per_page=10&page=1`;
  try {
    const response = await requestDiscogs<DiscogsSearchResponse>(url, log);
    return response.results ?? [];
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return [];
    log.warn({ err: error, style }, 'Discogs style search failed (swallowed)');
    return [];
  }
}

async function requestDiscogs<T>(url: string, log: Logger): Promise<T> {
  return await withProviderRateLimit('discogs', discogsLimiter, log, async () => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': DISCOGS_USER_AGENT
    };

    const token = process.env.DISCOGS_TOKEN;
    if (token) {
      headers.Authorization = `Discogs token=${token}`;
    }

    return await fetchJson<T>(url, { headers });
  });
}

function addCandidate(
  bag: Map<string, { name: string; normalizedName: string; score: number; signals: number }>,
  key: string,
  name: string,
  scoreDelta: number,
  signalDelta: number
) {
  const existing = bag.get(key);
  if (!existing) {
    bag.set(key, { name, normalizedName: key, score: scoreDelta, signals: signalDelta });
    return;
  }
  existing.name = name || existing.name;
  existing.score += scoreDelta;
  existing.signals += signalDelta;
}

function bump(map: Map<string, number>, raw: string) {
  const key = String(raw ?? '').trim();
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topKeys(map: Map<string, number>, limit: number): string[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function hasOverlap(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a.map((v) => v.toLowerCase()));
  return b.some((v) => set.has(String(v).toLowerCase()));
}

function extractArtistFromTitle(title: string | undefined): string | null {
  const raw = String(title ?? '').trim();
  if (!raw) return null;

  // Discogs search results often format release titles as "Artist - Title".
  const parts = raw.split(' - ');
  const left = String(parts[0] ?? '').trim();
  if (!left) return null;

  // Remove common suffixes like "(2)" for disambiguation.
  return left.replace(/\s*\(\d+\)\s*$/, '').trim() || null;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
