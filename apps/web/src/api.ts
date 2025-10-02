import type { Artist, ProviderId, ProviderMetadata, Track } from '@musicdiscovery/shared';
import { getSelectedProvider } from './providerSelection.js';

const baseUrl = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api').replace(/\/$/, '');

async function request<T>(path: string, options: { includeProvider?: boolean } = {}): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (options.includeProvider !== false) {
    const provider = getSelectedProvider();
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
  const data = await request<{ items: Artist[] }>(`/spotify/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  return data.items;
}

export async function getRelatedArtists(id: string, limit = 10): Promise<Artist[]> {
  const data = await request<{ items: Artist[] }>(`/spotify/artists/${id}/related?limit=${limit}`);
  return data.items;
}

export async function getTopTracks(id: string, market?: string, limit = 10): Promise<Track[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (market) params.set('market', market);
  const data = await request<{ items: Track[] }>(`/spotify/artists/${id}/top-tracks?${params.toString()}`);
  return data.items;
}
