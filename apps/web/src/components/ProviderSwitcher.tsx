import React, { useEffect, useState } from 'react';
import { PROVIDERS, type ProviderId, type ProviderMetadata } from '@musicdiscovery/shared';
import { getProviderCatalog } from '../api';
import { getSelectedProvider, setSelectedProvider, syncProviderSelection } from '../providerSelection';

export default function ProviderSwitcher() {
  const [options, setOptions] = useState<ProviderMetadata[]>(PROVIDERS);
  const [value, setValue] = useState<ProviderId>(() => getSelectedProvider());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catalog = await getProviderCatalog();
        if (cancelled) return;
        setOptions(catalog.items);
        const next = syncProviderSelection(
          catalog.items.map((item) => item.id),
          catalog.default
        );
        setValue(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError('Kon providers niet laden');
        console.error('Failed to load provider metadata', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ProviderId;
    if (next === value) return;
    setSelectedProvider(next);
    setValue(next);
    window.location.reload();
  }

  return (
    <div className="provider-switcher">
      <label>
        <span className="label">Provider</span>
        <select
          value={value}
          onChange={handleChange}
          disabled={loading && options.length === 0}
          className="provider-switcher__select"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {loading ? <span className="muted provider-switcher__hint">Laden…</span> : null}
      {error ? (
        <span className="error provider-switcher__hint" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
