import { DEFAULT_PROVIDER_MODE, PROVIDER_MODES, type ProviderId, isProviderId } from '@musicdiscovery/shared';

const STORAGE_KEY = 'musicdiscovery:provider';

let fallbackProvider: ProviderId = (() => {
  const envDefault = import.meta.env.VITE_DEFAULT_PROVIDER;
  if (isProviderId(envDefault)) {
    return envDefault;
  }
  return DEFAULT_PROVIDER_MODE;
})();

export function syncProviderSelection(available: ProviderId[], defaultProvider: ProviderId): ProviderId {
  fallbackProvider = defaultProvider;
  if (typeof window === 'undefined') {
    return fallbackProvider;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isProviderId(stored) && available.includes(stored)) {
    return stored;
  }
  window.localStorage.setItem(STORAGE_KEY, defaultProvider);
  return defaultProvider;
}

export function getSelectedProvider(): ProviderId {
  if (typeof window === 'undefined') {
    return fallbackProvider;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isProviderId(stored)) {
    return stored;
  }
  window.localStorage.setItem(STORAGE_KEY, fallbackProvider);
  return fallbackProvider;
}

export function setSelectedProvider(id: ProviderId) {
  fallbackProvider = id;
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, id);
}

export function isSelectableProvider(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_MODES as readonly string[]).includes(value);
}
