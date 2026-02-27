import pLimitLib from 'p-limit';

import type { Artist, MusicProvider, Track } from '../types.js';
import type { HttpRequestOptions } from '../httpClient.js';
import { httpGetJson } from '../httpClient.js';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const DEEZER_API_URL = 'https://api.deezer.com';

function withPrefix(provider: 'deezer' | 'itunes:artist' | 'itunes:track', id: string) {
  return `${provider}:${id}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function dedupeById(items: Artist[]): Artist[] {
  const seen = new Set<string>();
  const result: Artist[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

interface TokenlessProviderOptions {
  http?: HttpRequestOptions;
  concurrency?: number;
}

const DEFAULT_HTTP_OPTIONS: HttpRequestOptions = { retry: 1 };
const DEFAULT_CONCURRENCY = 5;

interface DeezerArtistData {
  id: number;
  name: string;
  picture_xl?: string;
  picture_big?: string;
  nb_fan?: number;
  genres?: { data: Array<{ name: string }> };
}

interface ItunesArtistData {
  artistId: number;
  artistName: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
}

interface DeezerTrackData {
  id: number;
  title: string;
  preview?: string;
  duration: number;
  contributors?: Array<{ id: number; name: string }>;
}

interface ItunesTrackData {
  trackId: number;
  trackName: string;
  previewUrl?: string;
  trackTimeMillis: number;
  artistId: number;
  artistName: string;
}

export class TokenlessProvider implements MusicProvider {
  private readonly httpOptions: HttpRequestOptions;
  private readonly limit: ReturnType<typeof pLimitLib>;

  constructor(options: TokenlessProviderOptions = {}) {
    this.httpOptions = { ...DEFAULT_HTTP_OPTIONS, ...(options.http ?? {}) };
    this.limit = pLimitLib(options.concurrency ?? DEFAULT_CONCURRENCY);
  }

  private fetchJson<T>(url: string, options: HttpRequestOptions = {}) {
    const headers = { ...(this.httpOptions.headers ?? {}), ...(options.headers ?? {}) };
    const merged: HttpRequestOptions = {
      ...this.httpOptions,
      ...options,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    };

    return this.limit(() => httpGetJson<T>(url, merged));
  }

  async searchArtists(query: string, limit: number): Promise<Artist[]> {
    if (!query.trim()) return [];

    // Prefer Deezer search for richer metadata
    const deezer = await this.fetchJson<{ data: DeezerArtistData[] }>(
      `${DEEZER_API_URL}/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    const deezerArtists: Artist[] = deezer.data.slice(0, limit).map((artist: DeezerArtistData) => ({
      id: withPrefix('deezer', String(artist.id)),
      name: artist.name,
      imageUrl: artist.picture_xl || artist.picture_big || undefined,
      genres: [],
      popularity: artist.nb_fan ? Number(artist.nb_fan) : undefined
    }));

    if (deezerArtists.length >= limit) return deezerArtists;

    const fallback = await this.fetchJson<{ results: ItunesArtistData[] }>(
      `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(query)}&entity=musicArtist&limit=${limit}`
    );
    const itunesArtists = fallback.results.map((artist: ItunesArtistData) => ({
      id: withPrefix('itunes:artist', String(artist.artistId)),
      name: artist.artistName,
      imageUrl: artist.artworkUrl100 ? artist.artworkUrl100.replace('100x100', '512x512') : undefined,
      genres: artist.primaryGenreName ? [artist.primaryGenreName] : undefined
    }));

    return [...deezerArtists, ...itunesArtists].slice(0, limit);
  }

  async getArtist(artistId: string): Promise<Artist | null> {
    if (artistId.startsWith('deezer:')) {
      const id = artistId.replace('deezer:', '');
      const data = await this.fetchJson<DeezerArtistData>(`${DEEZER_API_URL}/artist/${id}`);
      return {
        id: withPrefix('deezer', String(data.id)),
        name: data.name,
        imageUrl: data.picture_xl || data.picture_big || undefined,
        genres: data.genres?.data?.map((g) => g.name) ?? undefined,
        popularity: data.nb_fan ? Number(data.nb_fan) : undefined
      };
    }

    if (artistId.startsWith('itunes:artist:')) {
      const id = artistId.replace('itunes:artist:', '');
      const data = await this.fetchJson<{ results: ItunesArtistData[] }>(
        `${ITUNES_SEARCH_URL}?term=${id}&entity=musicArtist&limit=1`
      );
      const artist = data.results[0];
      if (!artist) return null;
      return {
        id: withPrefix('itunes:artist', String(artist.artistId)),
        name: artist.artistName,
        imageUrl: artist.artworkUrl100 ? artist.artworkUrl100.replace('100x100', '512x512') : undefined,
        genres: artist.primaryGenreName ? [artist.primaryGenreName] : undefined
      };
    }

    return null;
  }

  async getRelatedArtists(artistId: string, limit: number): Promise<Artist[]> {
    const styleMatched: Artist[] = [];
    const deezerId = await this.resolveDeezerArtistId(artistId);

    if (deezerId) {
      const deezerRelated = await this.lookupDeezerRelated(deezerId, limit);
      styleMatched.push(...deezerRelated);
      if (styleMatched.length >= limit) {
        return styleMatched.slice(0, limit);
      }
    }

    const artist = await this.getArtist(artistId);
    if (!artist || !artist.genres?.length) {
      return dedupeById(styleMatched).slice(0, limit);
    }

    const genreMatches = await this.lookupItunesArtistsByGenres(artist, limit - styleMatched.length);
    styleMatched.push(...genreMatches);

    return dedupeById(styleMatched).slice(0, limit);
  }

  async getTopTracks(artistId: string, _market: string, limit: number): Promise<Track[]> {
    if (!artistId.startsWith('deezer:')) {
      const artist = await this.getArtist(artistId);
      if (!artist) return [];
      const matches = await this.searchArtists(artist.name, 1);
      const deezerId = matches.find((a) => a.id.startsWith('deezer:'))?.id;
      if (deezerId) artistId = deezerId;
      else return this.lookupItunesTopTracks(artist.name, limit);
    }

    const id = artistId.replace('deezer:', '');
    const data = await this.fetchJson<{ data: DeezerTrackData[] }>(`${DEEZER_API_URL}/artist/${id}/top?limit=${limit}`);
    const tracks = data.data.map((track: DeezerTrackData) => ({
      id: withPrefix('deezer', String(track.id)),
      name: track.title,
      previewUrl: track.preview || undefined,
      durationMs: Number(track.duration) * 1000,
      artists: track.contributors?.map((c) => ({ id: withPrefix('deezer', String(c.id)), name: c.name })) ?? []
    }));

    if (tracks.length === 0) {
      const artist = await this.getArtist(artistId);
      return artist ? this.lookupItunesTopTracks(artist.name, limit) : [];
    }

    return tracks;
  }

  async getTrack(trackId: string): Promise<Track | null> {
    if (trackId.startsWith('deezer:')) {
      const id = trackId.replace('deezer:', '');
      const data = await this.fetchJson<DeezerTrackData>(`${DEEZER_API_URL}/track/${id}`);
      return {
        id: withPrefix('deezer', String(data.id)),
        name: data.title,
        previewUrl: data.preview || undefined,
        durationMs: Number(data.duration) * 1000,
        artists: data.contributors?.map((c) => ({ id: withPrefix('deezer', String(c.id)), name: c.name })) ?? []
      };
    }

    if (trackId.startsWith('itunes:track:')) {
      const id = trackId.replace('itunes:track:', '');
      const data = await this.fetchJson<{ results: ItunesTrackData[] }>(`https://itunes.apple.com/lookup?id=${id}`);
      const track = data.results[0];
      if (!track) return null;
      return {
        id: withPrefix('itunes:track', String(track.trackId)),
        name: track.trackName,
        previewUrl: track.previewUrl || undefined,
        durationMs: Number(track.trackTimeMillis),
        artists: [{ id: withPrefix('itunes:artist', String(track.artistId)), name: track.artistName }]
      };
    }

    return null;
  }

  private async lookupItunesTopTracks(name: string, limit: number): Promise<Track[]> {
    const data = await this.fetchJson<{ results: ItunesTrackData[] }>(
      `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(name)}&entity=song&limit=${limit}`
    );
    return data.results.slice(0, limit).map((track: ItunesTrackData) => ({
      id: withPrefix('itunes:track', String(track.trackId)),
      name: track.trackName,
      previewUrl: track.previewUrl || undefined,
      durationMs: Number(track.trackTimeMillis),
      artists: [{ id: withPrefix('itunes:artist', String(track.artistId)), name: track.artistName }]
    }));
  }

  private async resolveDeezerArtistId(artistId: string): Promise<string | null> {
    if (artistId.startsWith('deezer:')) {
      return artistId.replace('deezer:', '');
    }

    const artist = await this.getArtist(artistId);
    if (!artist) return null;

    const matches = await this.searchArtists(artist.name, 5);
    const normalizedName = normalize(artist.name);
    const deezer =
      matches.find((candidate) => candidate.id.startsWith('deezer:') && normalize(candidate.name) === normalizedName) ??
      matches.find((candidate) => candidate.id.startsWith('deezer:'));
    return deezer ? deezer.id.replace('deezer:', '') : null;
  }

  private async lookupDeezerRelated(id: string, limit: number): Promise<Artist[]> {
    const data = await this.fetchJson<{ data: DeezerArtistData[] }>(`${DEEZER_API_URL}/artist/${id}/related?limit=${limit}`);
    return data.data.slice(0, limit).map((artist: DeezerArtistData) => ({
      id: withPrefix('deezer', String(artist.id)),
      name: artist.name,
      imageUrl: artist.picture_xl || artist.picture_big || undefined,
      genres: artist.genres?.data?.map((g) => g.name) ?? undefined,
      popularity: artist.nb_fan ? Number(artist.nb_fan) : undefined
    }));
  }

  private async lookupItunesArtistsByGenres(artist: Artist, limit: number): Promise<Artist[]> {
    if (limit <= 0) return [];
    const related: Artist[] = [];
    const targetGenres = Array.from(new Set((artist.genres ?? []).map(normalize))).filter(Boolean);
    const exclude = artist.id;
    const excludedNames = new Set<string>([normalize(artist.name)]);

    const genreResults = await Promise.all(
      targetGenres.map(async (genre) => {
        if (!genre) {
          return [] as ItunesArtistData[];
        }
        try {
          const data = await this.fetchJson<{ results: ItunesArtistData[] }>(
            `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(genre)}&entity=musicArtist&limit=${Math.max(limit * 3, 25)}`
          );
          return data.results;
        } catch {
          return [];
        }
      })
    );

    outer: for (const items of genreResults) {
      for (const item of items) {
        const normalized = normalize(item.primaryGenreName ?? '');
        if (!normalized || !targetGenres.includes(normalized)) continue;
        const id = withPrefix('itunes:artist', String(item.artistId));
        if (id === exclude) continue;
        if (excludedNames.has(normalize(item.artistName))) continue;

        related.push({
          id,
          name: item.artistName,
          imageUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100', '512x512') : undefined,
          genres: item.primaryGenreName ? [item.primaryGenreName] : undefined
        });

        excludedNames.add(normalize(item.artistName));

        if (related.length >= limit) break outer;
      }
    }

    return related;
  }
}
