import type {
  Artist,
  ProviderId,
  ProviderMetadata,
  RelatedArtistsResponse,
  Track
} from '@musicdiscovery/shared';

import type { ArtistDetailsPayload } from './cache/artistCache';
import { getSelectedProvider } from './providerSelection';

const apiPrefix = (import.meta.env.VITE_API_PREFIX ?? '/api').replace(/\/$/, '');

async function request<T>(
  path: string,
  options: { includeProvider?: boolean; provider?: ProviderId } = {}
): Promise<T> {
  const url = new URL(path, 'http://placeholder.local');

  if (options.includeProvider !== false) {
    const provider = options.provider ?? getSelectedProvider();
    url.searchParams.set('provider', provider);
  }

  const pathname = `${url.pathname}${url.search}`;
  const res = await fetch(`${apiPrefix}${pathname}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function getProviderCatalog(): Promise<{ default: ProviderId; items: ProviderMetadata[] }> {
  return request('/providers', { includeProvider: false });
}

// Kept signature as (query, limit) so hooks can call searchArtists(trimmed, limit)
export async function searchArtists(query: string, limit = 10, provider?: ProviderId): Promise<Artist[]> {
  const data = await request<{ items: Artist[] }>(
    `/music/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    { provider }
  );
  return data.items;
}

export async function getRelatedArtistsResponse(
  id: string,
  limit = 10,
  provider?: ProviderId
): Promise<RelatedArtistsResponse> {
  return request<RelatedArtistsResponse>(
    `/music/artists/${encodeURIComponent(id)}/related?limit=${limit}`,
    { provider }
  );
}

export async function getRelatedArtists(id: string, limit = 10, provider?: ProviderId): Promise<Artist[]> {
  const data = await getRelatedArtistsResponse(id, limit, provider);
  return data.items;
}

export async function getTopTracks(
  id: string,
  market?: string,
  limit = 10,
  provider?: ProviderId
): Promise<Track[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (market) params.set('market', market);
  const data = await request<{ items: Track[] }>(
    `/music/artists/${encodeURIComponent(id)}/top-tracks?${params.toString()}`,
    { provider }
  );
  return data.items;
}

export async function getTrack(id: string, provider?: ProviderId): Promise<Track> {
  return request<Track>(`/music/tracks/${encodeURIComponent(id)}`, { provider });
}

export async function getArtist(id: string, provider?: ProviderId): Promise<Artist> {
  return request<Artist>(`/music/artists/${encodeURIComponent(id)}`, { provider });
}

export async function fetchArtistDetails(
  artistId: string,
  provider: ProviderId,
  options: { topTrackLimit?: number; relatedLimit?: number } = {}
): Promise<ArtistDetailsPayload> {
  const { topTrackLimit = 5, relatedLimit = 8 } = options;

  const [artist, topTracks, relatedResponse] = await Promise.all([
    getArtist(artistId, provider),
    getTopTracks(artistId, undefined, topTrackLimit, provider),
    getRelatedArtistsResponse(artistId, relatedLimit, provider)
  ]);

  return {
    artist,
    topTracks,
    relatedArtists: relatedResponse.items,
    serviceMetadata: relatedResponse.serviceMetadata
  };
}
