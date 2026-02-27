import type { ProviderId } from '@musicdiscovery/shared';

// Provider selection has been removed for GitHub Pages deployment.
// The app is intentionally locked to Deezer-first "tokenless" mode with iTunes links available.
const LOCKED_PROVIDER: ProviderId = 'tokenless';

export function syncProviderSelection(_available: ProviderId[], _defaultProvider: ProviderId): ProviderId {
  return LOCKED_PROVIDER;
}

export function getSelectedProvider(): ProviderId {
  return LOCKED_PROVIDER;
}

export function setSelectedProvider(_id: ProviderId) {
  // no-op
}

export function isSelectableProvider(value: unknown): value is ProviderId {
  return value === 'tokenless' || value === 'itunes';
}
