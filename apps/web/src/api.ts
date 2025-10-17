import type { Artist, ProviderId, ProviderMetadata, SmartRelatedResponse, Track } from '@musicdiscovery/shared';
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

export async function getSmartRelatedArtists(query: string, limit = 10): Promise<SmartRelatedResponse> {
  return request<SmartRelatedResponse>(
    `/deezer/related-smart?query=${encodeURIComponent(query)}&limit=${limit}`,
    { includeProvider: false }
  );
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
  const [artist, topTracks, initialRelated] = await Promise.all([
    getArtist(artistId, provider),
    getTopTracks(artistId, undefined, topTrackLimit, provider),
    getRelatedArtists(artistId, relatedLimit, provider)
  ]);

  let relatedArtists = initialRelated;

  if (relatedArtists.length === 0) {
    console.log(
      `[smart-related] initiating fallback for "${artist.name}" (artistId=${artistId}) limit=${relatedLimit}`
    );
    try {
      const smart = await getSmartRelatedArtists(artist.name, relatedLimit);
      const seeds = smart.seeds ?? [];
      const mapped = smart.items.map(mapSmartArtistToArtist);
      if (mapped.length > 0) {
        console.log(
          `[smart-related] results for "${artist.name}" strategy=${smart.strategy}`,
          {
            query: smart.query,
            seeds,
            results: mapped.map((item) => ({ id: item.id, name: item.name }))
          }
        );
        relatedArtists = mapped;
      } else {
        console.warn(
          `[smart-related] no matches found for "${artist.name}" after fallback`,
          { query: smart.query, seeds }
        );
      }
    } catch (error) {
      console.error(`[smart-related] failed to fetch fallback results for "${artist.name}"`, error);
    }
  }

  return {
    artist,
    topTracks,
    relatedArtists,
    provider,
    fetchedAt: Date.now()
  };
}

function mapSmartArtistToArtist(item: SmartRelatedResponse['items'][number]): Artist {
  const rawId = String(item.id);
  const id = rawId.startsWith('deezer:') ? rawId : `deezer:${rawId}`;
  const imageUrl =
    item.picture_xl ??
    item.picture_big ??
    item.picture_medium ??
    item.picture_small ??
    item.picture ??
    undefined;

  return {
    id,
    name: item.name,
    imageUrl,
    popularity: item.nb_fan
  };
}
