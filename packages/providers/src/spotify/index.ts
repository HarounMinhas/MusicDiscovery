import type { Artist, MusicProvider, Track } from '../types.js';

export class SpotifyProvider implements MusicProvider {
  async searchArtists(): Promise<Artist[]> {
    throw new Error('SpotifyProvider not implemented in scaffold');
  }

  async getArtist(): Promise<Artist | null> {
    throw new Error('SpotifyProvider not implemented in scaffold');
  }

  async getRelatedArtists(): Promise<Artist[]> {
    throw new Error('SpotifyProvider not implemented in scaffold');
  }

  async getTopTracks(): Promise<Track[]> {
    throw new Error('SpotifyProvider not implemented in scaffold');
  }

  async getTrack(): Promise<Track | null> {
    throw new Error('SpotifyProvider not implemented in scaffold');
  }
}
