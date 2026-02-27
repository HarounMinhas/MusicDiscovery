import type { Logger } from 'pino';
import { getSimilarArtistsFromDiscogs } from './discogs.js';
import { getSimilarArtistsFromLastFm } from './lastfm.js';
import { getSimilarArtistsFromMusicBrainz } from './musicbrainz.js';
import type { FallbackProvider, FallbackResult, FallbackSimilarArtist } from './types.js';

interface FallbackContext {
  log: Logger;
  query: string;
  limit: number;
}

export async function getDeterministicFallbackSimilarArtists(
  ctx: FallbackContext
): Promise<FallbackResult> {
  const { log, query, limit } = ctx;

  try {
    log.info({ query, limit }, 'deterministic fallback pipeline invoked');

    const [lastfm, musicbrainz, discogs] = await Promise.all([
      getSimilarArtistsFromLastFm(query, limit, log),
      getSimilarArtistsFromMusicBrainz(query, limit, log),
      getSimilarArtistsFromDiscogs(query, limit, log)
    ]);

    const combined = combineAndRankCandidates([
      ...reweightByConfidence(lastfm, 'lastfm'),
      ...reweightByConfidence(musicbrainz, 'musicbrainz'),
      ...reweightByConfidence(discogs, 'discogs')
    ]);

    return {
      strategy: 'deterministic-fallback',
      items: combined.slice(0, Math.min(Math.max(limit, 1), 25)),
      cacheHit: false
    };
  } catch (error) {
    // Never throw from fallback logic.
    log.warn({ err: error }, 'deterministic fallback pipeline failed (swallowed)');
    return { strategy: 'deterministic-fallback', items: [], cacheHit: false };
  }
}

function combineAndRankCandidates(items: FallbackSimilarArtist[]): FallbackSimilarArtist[] {
  const byName = new Map<string, FallbackSimilarArtist>();

  for (const item of items) {
    const key = item.normalizedName;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, item);
      continue;
    }

    const stronger = item.similarityScore >= existing.similarityScore ? item : existing;
    const weaker = stronger === item ? existing : item;

    byName.set(key, {
      ...stronger,
      // Fuse confidence/similarity from both matches while preserving dominant provider metadata.
      similarityScore: clamp01(stronger.similarityScore + weaker.similarityScore * 0.2),
      confidenceScore: clamp01(Math.max(stronger.confidenceScore, weaker.confidenceScore))
    });
  }

  return Array.from(byName.values()).sort((a, b) => b.similarityScore - a.similarityScore);
}

function reweightByConfidence(items: FallbackSimilarArtist[], provider: FallbackProvider): FallbackSimilarArtist[] {
  const reliability = getProviderReliability(provider);

  // Reweight similarity by confidence so low-confidence matches do not outrank higher-confidence ones.
  // Keep scores within 0–1 and deterministic ordering.
  return items
    .map((item) => {
      const confidence = clamp01(item.confidenceScore);
      const similarity = clamp01(item.similarityScore);

      // Soft reweighting: similarity * (0.5 + 0.5*confidence) * reliability
      const weighted = clamp01(similarity * (0.5 + 0.5 * confidence) * reliability);

      return {
        ...item,
        similarityScore: weighted
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore);
}

function getProviderReliability(provider: FallbackProvider): number {
  switch (provider) {
    case 'lastfm':
      return 1.0;
    case 'musicbrainz':
      return 0.85;
    case 'discogs':
      return 0.8;
    default:
      return 0.8;
  }
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
