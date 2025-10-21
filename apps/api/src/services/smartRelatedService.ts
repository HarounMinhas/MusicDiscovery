import { mapWithConcurrency } from '../utils/concurrency.js';
import type { DeezerArtist } from './types.js';
import {
  getRelatedArtists,
  pickBestDeezerArtist,
  searchArtistByName
} from './deezerService.js';
import { getGroupWithMemberRels, searchGroupByName } from './musicbrainzService.js';
import { getSmartRelatedConfig } from './smartRelatedConfig.js';
import { SmartRelatedError } from './errors.js';

export type SmartRelatedStrategy = 'deezer-related' | 'fallback-members-aggregation';

export interface SmartRelatedResult {
  strategy: SmartRelatedStrategy;
  items: DeezerArtist[];
  seeds: string[];
  cacheHit: boolean;
}

export async function relatedByBandOrMembers(
  bandName: string,
  limit: number,
  options: { allowFallback: boolean }
): Promise<SmartRelatedResult> {
  if (!bandName.trim()) {
    throw new SmartRelatedError('BAD_REQUEST', "Param 'query' is required");
  }

  const normalizedLimit = Math.min(Math.max(limit, 1), 20);
  const searchResult = await searchArtistByName(bandName);
  let cacheHit = searchResult.cacheHit;
  const best = pickBestDeezerArtist(bandName, searchResult.artists);
  if (best) {
    const related = await getRelatedArtists(best.id, normalizedLimit);
    cacheHit = cacheHit || related.cacheHit;
    const directRelated = related.artists.slice(0, normalizedLimit);
    if (directRelated.length > 0 || !options.allowFallback) {
      return {
        strategy: 'deezer-related',
        items: directRelated,
        seeds: [best.name?.trim() || bandName],
        cacheHit
      };
    }
  }

  if (!options.allowFallback) {
    throw new SmartRelatedError('NOT_FOUND', 'No related artists found', { query: bandName });
  }

  const config = getSmartRelatedConfig();
  const groupResult = await searchGroupByName(bandName);
  cacheHit = cacheHit || groupResult.cacheHit;
  if (!groupResult.artist) {
    throw new SmartRelatedError('NOT_FOUND', 'No related artists found', { query: bandName });
  }

  const groupWithRels = await getGroupWithMemberRels(groupResult.artist.id);
  cacheHit = cacheHit || groupWithRels.cacheHit;
  if (!groupWithRels.group) {
    throw new SmartRelatedError('NOT_FOUND', 'No related artists found', { query: bandName });
  }

  const members = (groupWithRels.group.relations ?? [])
    .filter((relation) => relation.type === 'member of band' && relation.artist?.name)
    .map((relation) => relation.artist!.name!);

  const uniqueMembers: string[] = [];
  const seenMembers = new Set<string>();
  for (const member of members) {
    const normalized = member.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seenMembers.has(key)) continue;
    seenMembers.add(key);
    uniqueMembers.push(normalized);
    if (uniqueMembers.length >= config.maxMembers) break;
  }

  const limitedMembers = uniqueMembers;
  if (limitedMembers.length === 0) {
    throw new SmartRelatedError('NOT_FOUND', 'No related artists found', { query: bandName });
  }

  const bag = new Map<
    number,
    { artist: DeezerArtist; score: number; contributors: Set<string>; popularityApplied: boolean }
  >();

  await mapWithConcurrency(limitedMembers, async (memberName) => {
    try {
      const memberSearch = await searchArtistByName(memberName);
      cacheHit = cacheHit || memberSearch.cacheHit;
      const match = pickBestDeezerArtist(memberName, memberSearch.artists);
      if (!match) return;
      const related = await getRelatedArtists(match.id, normalizedLimit * 2);
      cacheHit = cacheHit || related.cacheHit;
      for (const artist of related.artists) {
        const existing = bag.get(artist.id);
        const popularity = (artist.nb_fan ?? 0) / 1_000_000;
        if (!existing) {
          bag.set(artist.id, {
            artist,
            score: 1 + popularity,
            contributors: new Set<string>([memberName]),
            popularityApplied: popularity > 0
          });
          continue;
        }
        existing.artist = artist;
        if (!existing.contributors.has(memberName)) {
          existing.contributors.add(memberName);
          existing.score += 1;
        }
        if (!existing.popularityApplied && popularity > 0) {
          existing.score += popularity;
          existing.popularityApplied = true;
        }
      }
    } catch (error) {
      if (error instanceof SmartRelatedError) {
        // Swallow individual member errors to keep degraded results flowing
        return;
      }
      throw error;
    }
  }, 3);

  const sorted = Array.from(bag.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, normalizedLimit)
    .map((entry) => entry.artist);

  if (sorted.length === 0) {
    throw new SmartRelatedError('NOT_FOUND', 'No related artists found', { query: bandName });
  }

  return {
    strategy: 'fallback-members-aggregation',
    items: sorted,
    seeds: limitedMembers,
    cacheHit
  };
}
