import type { Artist, MusicProvider, Track } from '../types.js';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

function withArtistPrefix(id: string) {
  return `itunes:artist:${id}`;
}

function withTrackPrefix(id: string) {
  return `itunes:track:${id}`;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(`ItunesProvider request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export class ItunesProvider implements MusicProvider {
  async searchArtists(query: string, limit: number): Promise<Artist[]> {
    if (!query.trim()) return [];
    const data = await fetchJson<{ results: any[] }>(`${ITUNES_SEARCH_URL}?term=${encodeURIComponent(query)}&entity=musicArtist&limit=${limit}`);
    return data.results.slice(0, limit).map((artist) => ({
      id: withArtistPrefix(String(artist.artistId)),
      name: artist.artistName,
      imageUrl: artist.artworkUrl100 ? artist.artworkUrl100.replace('100x100', '512x512') : undefined,
      genres: artist.primaryGenreName ? [artist.primaryGenreName] : undefined
    }));
  }

  async getArtist(artistId: string): Promise<Artist | null> {
    if (!artistId.startsWith('itunes:artist:')) return null;
    const id = artistId.replace('itunes:artist:', '');
    const data = await fetchJson<{ results: any[] }>(`${ITUNES_LOOKUP_URL}?id=${id}`);
    const artist = data.results.find((result) => result.wrapperType === 'artist');
    if (!artist) return null;
    return {
      id: withArtistPrefix(String(artist.artistId)),
      name: artist.artistName,
      imageUrl: artist.artworkUrl100 ? artist.artworkUrl100.replace('100x100', '512x512') : undefined,
      genres: artist.primaryGenreName ? [artist.primaryGenreName] : undefined
    };
  }

  async getRelatedArtists(_artistId: string, _limit: number): Promise<Artist[]> {
    // The iTunes Search API does not expose related artists, so return an empty array.
    return [];
  }

  async getTopTracks(artistId: string, _market: string, limit: number): Promise<Track[]> {
    const artist = await this.getArtist(artistId);
    if (!artist) return [];
    const data = await fetchJson<{ results: any[] }>(`${ITUNES_LOOKUP_URL}?id=${artist.id.replace('itunes:artist:', '')}&entity=song&limit=${limit}`);
    const tracks = data.results.filter((item) => item.wrapperType === 'track');
    return tracks.slice(0, limit).map((track) => ({
      id: withTrackPrefix(String(track.trackId)),
      name: track.trackName,
      previewUrl: track.previewUrl || undefined,
      durationMs: Number(track.trackTimeMillis ?? 0),
      artists: [{ id: withArtistPrefix(String(track.artistId)), name: track.artistName }]
    }));
  }

  async getTrack(trackId: string): Promise<Track | null> {
    if (!trackId.startsWith('itunes:track:')) return null;
    const id = trackId.replace('itunes:track:', '');
    const data = await fetchJson<{ results: any[] }>(`${ITUNES_LOOKUP_URL}?id=${id}`);
    const track = data.results.find((result) => result.wrapperType === 'track');
    if (!track) return null;
    return {
      id: withTrackPrefix(String(track.trackId)),
      name: track.trackName,
      previewUrl: track.previewUrl || undefined,
      durationMs: Number(track.trackTimeMillis ?? 0),
      artists: [{ id: withArtistPrefix(String(track.artistId)), name: track.artistName }]
    };
  }
}
