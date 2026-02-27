import { useCallback } from 'react';
import type { ProviderId, ProviderMetadata } from '@musicdiscovery/shared';

export type ProviderStatus = 'loading' | 'ready' | 'error';

interface ProviderSelectionState {
  provider: ProviderId;
  providers: ProviderMetadata[];
  status: ProviderStatus;
  error: string | null;
  selectProvider: (next: ProviderId) => void;
}

// Locked provider selection: always use Deezer-first tokenless mode.
// This intentionally disables runtime switching and removes any persisted selection.
const LOCKED_PROVIDER: ProviderId = 'tokenless';

const LOCKED_PROVIDERS: ProviderMetadata[] = [
  {
    id: 'tokenless',
    label: 'Deezer',
    description: 'Deezer-first mode zonder login.',
    supportsRelated: true,
    supportsTopTracks: true
  }
];

export function useProviderSelection(): ProviderSelectionState {
  const selectProvider = useCallback((_next: ProviderId) => {
    // no-op: provider selection removed
  }, []);

  return {
    provider: LOCKED_PROVIDER,
    providers: LOCKED_PROVIDERS,
    status: 'ready',
    error: null,
    selectProvider
  };
}
