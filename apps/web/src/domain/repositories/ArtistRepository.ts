import type { Artist, ProviderId, ServiceMetadata, Track } from '@musicdiscovery/shared';

export interface ArtistDetails {
  artist: Artist;
  topTracks: Track[];
  relatedArtists: Artist[];
  serviceMetadata?: ServiceMetadata;
}

export interface ArtistRepository {
  readonly provider: ProviderId;
  search(query: string, limit?: number): Promise<Artist[]>;
  getDetails(artistId: string, options?: { topTrackLimit?: number; relatedLimit?: number }): Promise<ArtistDetails>;
}
