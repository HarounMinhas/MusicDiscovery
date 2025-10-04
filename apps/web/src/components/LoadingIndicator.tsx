import React from 'react';

interface LoadingIndicatorProps {
  label?: string;
}

export default function LoadingIndicator({ label = 'Laden…' }: LoadingIndicatorProps) {
  return (
    <div className="loading-indicator" role="status" aria-live="polite">
      <span className="loading-indicator__spinner" aria-hidden="true" />
      <span className="loading-indicator__label">{label}</span>
    </div>
  );
}
