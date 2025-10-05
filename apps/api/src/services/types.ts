export interface DeezerArtist {
  id: number;
  name: string;
  link?: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_fan?: number;
}

export interface DeezerSearchArtistResponse {
  data: DeezerArtist[];
  total: number;
}

export interface MusicBrainzArtist {
  id: string;
  name: string;
  type?: 'Group' | 'Person' | string;
  score?: number;
}

export interface MusicBrainzSearchResponse {
  artists: MusicBrainzArtist[];
}

export interface MusicBrainzArtistRelation {
  type?: string;
  artist?: {
    id: string;
    name: string;
    type?: string;
  };
}

export interface MusicBrainzArtistWithRelations extends MusicBrainzArtist {
  relations?: MusicBrainzArtistRelation[];
}
