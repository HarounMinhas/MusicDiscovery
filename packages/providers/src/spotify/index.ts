import type { Artist, MusicProvider, Track } from '../types.js';
import { ProviderNotImplementedError } from '../errors.js';

export class SpotifyProvider implements MusicProvider {
  async searchArtists(): Promise<Artist[]> {
    throw new ProviderNotImplementedError('spotify');
  }

  async getArtist(): Promise<Artist | null> {
    throw new ProviderNotImplementedError('spotify');
  }

  async getRelatedArtists(): Promise<Artist[]> {
    throw new ProviderNotImplementedError('spotify');
  }

  async getTopTracks(): Promise<Track[]> {
    throw new ProviderNotImplementedError('spotify');
  }

  async getTrack(): Promise<Track | null> {
    throw new ProviderNotImplementedError('spotify');
  }
}
