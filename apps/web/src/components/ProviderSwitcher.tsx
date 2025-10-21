import React from 'react';
import type { ProviderId, ProviderMetadata } from '@musicdiscovery/shared';

import type { ProviderStatus } from '../hooks/useProviderSelection';

interface ProviderSwitcherProps {
  value: ProviderId;
  status: ProviderStatus;
  error: string | null;
  options: ProviderMetadata[];
  onChange: (provider: ProviderId) => void;
}

export default function ProviderSwitcher({ value, status, error, options, onChange }: ProviderSwitcherProps) {
  const isLoading = status === 'loading';

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
          disabled={isLoading && options.length === 0}
          className="provider-switcher__select"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {isLoading ? <span className="muted provider-switcher__hint">Laden…</span> : null}
      {error ? (
        <span className="error provider-switcher__hint" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
