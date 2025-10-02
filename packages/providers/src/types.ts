export type Artist = {
  id: string;
  name: string;
  imageUrl?: string;
  genres?: string[];
  popularity?: number;
};

export type Track = {
  id: string;
  name: string;
  previewUrl?: string;
  durationMs: number;
  artists: { id: string; name: string }[];
};

export interface MusicProvider {
  searchArtists(query: string, limit: number): Promise<Artist[]>;
  getArtist(artistId: string): Promise<Artist | null>;
  getRelatedArtists(artistId: string, limit: number): Promise<Artist[]>;
  getTopTracks(artistId: string, market: string, limit: number): Promise<Track[]>;
  getTrack(trackId: string): Promise<Track | null>;
}
