import type { Artist, ProviderId, RelatedArtistsResponse, Track } from '@musicdiscovery/shared';
import type { ArtistDetails, ArtistRepository } from '../../domain/repositories/ArtistRepository';
import { request } from '../http/request';

export class HttpArtistRepository implements ArtistRepository {
  constructor(readonly provider: ProviderId) {}

  async search(query: string, limit = 10): Promise<Artist[]> {
    const data = await request<{ items: Artist[] }>(
      `/music/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      { provider: this.provider }
    );
    return data.items;
  }

  async getDetails(
    artistId: string,
    options: { topTrackLimit?: number; relatedLimit?: number } = {}
  ): Promise<ArtistDetails> {
    const { topTrackLimit = 5, relatedLimit = 8 } = options;
    const params = new URLSearchParams({ limit: String(topTrackLimit) });

    const [artist, topTracks, related] = await Promise.all([
      request<Artist>(`/music/artists/${encodeURIComponent(artistId)}`, { provider: this.provider }),
      request<{ items: Track[] }>(
        `/music/artists/${encodeURIComponent(artistId)}/top-tracks?${params.toString()}`,
        { provider: this.provider }
      ),
      request<RelatedArtistsResponse>(
        `/music/artists/${encodeURIComponent(artistId)}/related?limit=${relatedLimit}`,
        { provider: this.provider }
      )
    ]);

    return {
      artist,
      topTracks: topTracks.items,
      relatedArtists: related.items,
      serviceMetadata: related.serviceMetadata
    };
  }
}
