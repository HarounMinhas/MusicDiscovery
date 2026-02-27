import type { LRUCache } from 'lru-cache';
import type { CacheEntry } from '../cache.js';

export const CACHE_PROFILES = {
  artist: {
    max: 5000,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    description: 'Artist metadata cache'
  },
  track: {
    max: 10000,
    ttl: 5 * 60 * 1000, // 5 minutes
    description: 'Track metadata cache'
  },
  search: {
    max: 2000,
    ttl: 2 * 60 * 60 * 1000, // 2 hours
    description: 'Search results cache'
  },
  related: {
    max: 3000,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    description: 'Related artists cache'
  },
  smartRelated: {
    max: 1000,
    ttl: 12 * 60 * 60 * 1000, // 12 hours
    description: 'Smart related artists cache (MusicBrainz + Deezer)'
  },
  topTracks: {
    max: 5000,
    ttl: 5 * 60 * 1000, // 5 minutes
    description: 'Top tracks cache'
  }
} as const;

export type CacheProfileName = keyof typeof CACHE_PROFILES;

export interface CacheProfile {
  max: number;
  ttl: number;
  description: string;
}

export function getCacheProfile(name: CacheProfileName): Omit<CacheProfile, 'description'> {
  const profile = CACHE_PROFILES[name];
  return {
    max: profile.max,
    ttl: profile.ttl
  };
}

export type CacheOptions<T> = LRUCache.Options<string, CacheEntry<T>, unknown>;
