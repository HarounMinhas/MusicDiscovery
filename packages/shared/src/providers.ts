export const PROVIDER_MODES = ['tokenless', 'spotify', 'itunes'] as const;
export type ProviderId = (typeof PROVIDER_MODES)[number];

export interface ProviderMetadata {
  id: ProviderId;
  label: string;
  description: string;
  supportsRelated: boolean;
  supportsTopTracks: boolean;
}

export const PROVIDERS: ProviderMetadata[] = [
  {
    id: 'tokenless',
    label: 'Tokenless (Deezer + iTunes)',
    description:
      'Uses Deezer for related artists and top tracks while falling back to the iTunes Search API for discovery.',
    supportsRelated: true,
    supportsTopTracks: true
  },
  {
    id: 'spotify',
    label: 'Spotify',
    description: 'Full Spotify catalogue via the Client Credentials flow (requires credentials).',
    supportsRelated: true,
    supportsTopTracks: true
  },
  {
    id: 'itunes',
    label: 'iTunes',
    description: 'Pure iTunes Search API results – no related artists, but previews are available where provided.',
    supportsRelated: false,
    supportsTopTracks: true
  }
];

export const DEFAULT_PROVIDER_MODE: ProviderId = 'tokenless';

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_MODES as readonly string[]).includes(value);
}
