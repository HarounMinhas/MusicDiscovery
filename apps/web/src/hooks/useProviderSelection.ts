import { useCallback, useEffect, useRef, useState } from 'react';
import { PROVIDERS, type ProviderId, type ProviderMetadata } from '@musicdiscovery/shared';

import { getProviderCatalog } from '../api';
import { getSelectedProvider, setSelectedProvider, syncProviderSelection } from '../providerSelection';

export type ProviderStatus = 'loading' | 'ready' | 'error';

interface ProviderSelectionState {
  provider: ProviderId;
  providers: ProviderMetadata[];
  status: ProviderStatus;
  error: string | null;
  selectProvider: (next: ProviderId) => void;
}

export function useProviderSelection(): ProviderSelectionState {
  const [provider, setProvider] = useState<ProviderId>(() => getSelectedProvider());
  const [providers, setProviders] = useState<ProviderMetadata[]>(PROVIDERS);
  const [status, setStatus] = useState<ProviderStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const providerRef = useRef(provider);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus('loading');
        const catalog = await getProviderCatalog();
        if (cancelled) return;

        setProviders(catalog.items);
        setStatus('ready');
        setError(null);

        const next = syncProviderSelection(
          catalog.items.map((item) => item.id),
          catalog.default
        );

        if (next !== providerRef.current) {
          setSelectedProvider(next);
          setProvider(next);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load provider metadata', err);
        setError('Kon providers niet laden');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectProvider = useCallback((next: ProviderId) => {
    setProvider((current) => {
      if (current === next) {
        return current;
      }
      setSelectedProvider(next);
      return next;
    });
  }, []);

  return {
    provider,
    providers,
    status,
    error,
    selectProvider
  };
}
