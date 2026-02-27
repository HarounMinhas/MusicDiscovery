import type { ProviderId } from '@musicdiscovery/shared';
import { TokenlessProvider } from './tokenless/index.js';
import { ItunesProvider } from './itunes/index.js';
import type { MusicProvider } from './types.js';
import type { HttpRequestOptions } from './httpClient.js';

export interface ProviderFactoryOptions {
  http?: HttpRequestOptions;
}

const PROVIDER_FACTORIES: Record<ProviderId, (options?: ProviderFactoryOptions) => MusicProvider> = {
  // "tokenless" is our Deezer-first implementation (no OAuth / no secrets).
  tokenless: (options) => new TokenlessProvider({ http: options?.http }),
  itunes: () => new ItunesProvider()
};

export function createProvider(mode: ProviderId, options?: ProviderFactoryOptions): MusicProvider {
  const factory = PROVIDER_FACTORIES[mode];
  if (!factory) {
    throw new Error(`Unknown provider mode: ${mode}`);
  }
  return factory(options);
}
