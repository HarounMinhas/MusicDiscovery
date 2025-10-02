import { getSelectedProvider } from './providerSelection.js';
const baseUrl = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api').replace(/\/$/, '');
async function request(path, options = {}) {
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
    return res.json();
}
export async function getProviderCatalog() {
    return request('/providers', { includeProvider: false });
}
export async function searchArtists(query, limit = 10) {
    const data = await request(`/spotify/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    return data.items;
}
export async function getRelatedArtists(id, limit = 10) {
    const data = await request(`/spotify/artists/${id}/related?limit=${limit}`);
    return data.items;
}
export async function getTopTracks(id, market, limit = 10) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (market)
        params.set('market', market);
    const data = await request(`/spotify/artists/${id}/top-tracks?${params.toString()}`);
    return data.items;
}
