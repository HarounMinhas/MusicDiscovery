export type FallbackProvider = 'lastfm' | 'musicbrainz' | 'discogs';

export interface FallbackSimilarArtist {
  name: string;
  normalizedName: string;
  similarityScore: number;
  confidenceScore: number;
  uxLabel: string;
  source: FallbackProvider;
}

export interface FallbackResult {
  strategy: 'deezer-related' | 'fallback-members-aggregation' | 'deterministic-fallback';
  items: FallbackSimilarArtist[];
  cacheHit: boolean;
}
