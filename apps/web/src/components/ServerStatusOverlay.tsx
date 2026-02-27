import React from 'react';
import type { ServerPhase } from '../hooks/useServerStatus';
import { useI18n } from '../i18n';

interface ServerStatusOverlayProps {
  phase: ServerPhase;
  progress: number;
  onRetry: () => void;
}

export default function ServerStatusOverlay({
  phase,
  progress,
  onRetry
}: ServerStatusOverlayProps) {
  const { t } = useI18n();
  const statusLabel = phase === 'connecting' ? t('server.connecting') : t('server.booting');

  return (
    <div className="server-status-overlay" role="dialog" aria-modal="true" aria-label={t('server.aria')}>
      <div className="server-status-overlay__backdrop" />
      <div className="server-status-overlay__panel" role="document">
        <p className="label">{t('server.title')}</p>
        <p className="server-status__headline" role="status" aria-live="polite">
          {statusLabel}
        </p>
        <div
          className="server-status__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="server-status__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="muted server-status__percent">{t('server.progress', { percent: progress })}</p>
        <p className="muted server-status__note">{t('server.note')}</p>
        <div className="server-status__actions">
          <button type="button" className="server-status__button" onClick={onRetry}>
            {t('server.retry')}
          </button>
        </div>
      </div>
    </div>
  );
}
