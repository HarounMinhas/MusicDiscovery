import React, { useEffect, useState } from 'react';
import { PROVIDERS, type ProviderId, type ProviderMetadata } from '@musicdiscovery/shared';
import { getProviderCatalog } from '../api.js';
import { getSelectedProvider, setSelectedProvider, syncProviderSelection } from '../providerSelection.js';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="label">Provider</span>
        <select
          value={value}
          onChange={handleChange}
          disabled={loading && options.length === 0}
          style={{
            background: '#0f1320',
            color: 'white',
            borderRadius: 8,
            border: '1px solid #2a334c',
            padding: '6px 10px'
          }}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <span className="label" style={{ color: '#ffb4b4' }}>{error}</span> : null}
    </div>
  );
}
