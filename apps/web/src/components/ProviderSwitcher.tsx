import React, { useEffect, useRef, useState } from 'react';
import { PROVIDERS, type ProviderId, type ProviderMetadata } from '@musicdiscovery/shared';
import { getProviderCatalog } from '../api';
import { syncProviderSelection } from '../providerSelection';

interface ProviderSwitcherProps {
  value: ProviderId;
  onChange: (provider: ProviderId) => void;
}

export default function ProviderSwitcher({ value, onChange }: ProviderSwitcherProps) {
  const [options, setOptions] = useState<ProviderMetadata[]>(PROVIDERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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
        if (next !== valueRef.current) {
          onChange(next);
        }
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
  }, [onChange]);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ProviderId;
    if (next === value) return;
    onChange(next);
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
