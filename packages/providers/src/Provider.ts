import type { Artist, MusicProvider, Track } from './types.js';

export abstract class BaseMusicProvider implements MusicProvider {
  abstract searchArtists(query: string, limit: number): Promise<Artist[]>;
  abstract getArtist(artistId: string): Promise<Artist | null>;
  abstract getRelatedArtists(artistId: string, limit: number): Promise<Artist[]>;
  abstract getTopTracks(artistId: string, market: string, limit: number): Promise<Track[]>;
  abstract getTrack(trackId: string): Promise<Track | null>;
}
