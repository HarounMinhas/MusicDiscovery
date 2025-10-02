import type { ProviderId } from '@musicdiscovery/shared';
import { TokenlessProvider } from './tokenless/index.js';
import { SpotifyProvider } from './spotify/index.js';
import { ItunesProvider } from './itunes/index.js';
import type { MusicProvider } from './types.js';

const PROVIDER_FACTORIES: Record<ProviderId, () => MusicProvider> = {
  spotify: () => new SpotifyProvider(),
  tokenless: () => new TokenlessProvider(),
  itunes: () => new ItunesProvider()
};

export function createProvider(mode: ProviderId): MusicProvider {
  return PROVIDER_FACTORIES[mode]();
}
