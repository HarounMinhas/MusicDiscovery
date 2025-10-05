import type { Artist, ProviderId, ProviderMetadata, Track } from '@musicdiscovery/shared';
import type { ArtistDetailsPayload } from './cache/artistCache';
import { getSelectedProvider } from './providerSelection';

const baseUrl = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api').replace(/\/$/, '');

async function request<T>(
  path: string,
  options: { includeProvider?: boolean; provider?: ProviderId } = {}
): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (options.includeProvider !== false) {
    const provider = options.provider ?? getSelectedProvider();
    url.searchParams.set('provider', provider);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getProviderCatalog(): Promise<{ default: ProviderId; items: ProviderMetadata[] }> {
  return request('/providers', { includeProvider: false });
}

export async function searchArtists(query: string, limit = 10): Promise<Artist[]> {
  const data = await request<{ items: Artist[] }>(`/music/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  return data.items;
}

export async function getRelatedArtists(id: string, limit = 10, provider?: ProviderId): Promise<Artist[]> {
  const data = await request<{ items: Artist[] }>(`/music/artists/${id}/related?limit=${limit}`, {
    provider
  });
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
  const data = await request<{ items: Track[] }>(`/music/artists/${id}/top-tracks?${params.toString()}`, {
    provider
  });
  return data.items;
}

export async function getTrack(id: string): Promise<Track> {
  return request<Track>(`/music/tracks/${encodeURIComponent(id)}`);
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
  const [artist, topTracks, relatedArtists] = await Promise.all([
    getArtist(artistId, provider),
    getTopTracks(artistId, undefined, topTrackLimit, provider),
    getRelatedArtists(artistId, relatedLimit, provider)
  ]);

  return {
    artist,
    topTracks,
    relatedArtists,
    provider,
    fetchedAt: Date.now()
  };
}
