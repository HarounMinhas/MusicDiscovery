import React from 'react';
import type { ServiceMetadata, ServiceStatus } from '@musicdiscovery/shared';
import { useI18n } from '../i18n';

interface ServiceStatusLabelsProps {
  metadata?: ServiceMetadata;
}

interface ServiceInfo {
  label: string;
  tooltipKey:
    | 'services.deezer.tooltip'
    | 'services.lastfm.tooltip'
    | 'services.musicbrainz.tooltip'
    | 'services.discogs.tooltip';
}

const SERVICE_INFO: Record<string, ServiceInfo> = {
  deezer: {
    label: 'Deezer',
    tooltipKey: 'services.deezer.tooltip'
  },
  lastfm: {
    label: 'Last.fm',
    tooltipKey: 'services.lastfm.tooltip'
  },
  musicbrainz: {
    label: 'MusicBrainz',
    tooltipKey: 'services.musicbrainz.tooltip'
  },
  discogs: {
    label: 'Discogs',
    tooltipKey: 'services.discogs.tooltip'
  }
};

const STATUS_CONFIG: Record<
  ServiceStatus,
  {
    color: string;
    tooltipKey:
      | 'services.status.success'
      | 'services.status.empty'
      | 'services.status.error'
      | 'services.status.unused'
      | 'services.status.rate-limited';
  }
> = {
  success: {
    color: '#22c55e',
    tooltipKey: 'services.status.success'
  },
  empty: {
    color: '#ef4444',
    tooltipKey: 'services.status.empty'
  },
  error: {
    color: '#ef4444',
    tooltipKey: 'services.status.error'
  },
  unused: {
    color: '#d1d5db',
    tooltipKey: 'services.status.unused'
  },
  'rate-limited': {
    color: '#f59e0b',
    tooltipKey: 'services.status.rate-limited'
  }
};

export default function ServiceStatusLabels({ metadata }: ServiceStatusLabelsProps) {
  const { t } = useI18n();

  if (!metadata) {
    return null;
  }

  const services: Array<{ key: string; status: ServiceStatus }> = [
    { key: 'deezer', status: metadata.deezer },
    ...(metadata.lastfm ? [{ key: 'lastfm', status: metadata.lastfm }] : []),
    ...(metadata.musicbrainz ? [{ key: 'musicbrainz', status: metadata.musicbrainz }] : []),
    ...(metadata.discogs ? [{ key: 'discogs', status: metadata.discogs }] : [])
  ];

  return (
    <div className="service-status-labels" aria-label={t('services.aria')}>
      {services.map(({ key, status }) => {
        const info = SERVICE_INFO[key];
        const config = STATUS_CONFIG[status];
        
        if (!info || !config) return null;

        const tooltipText = `${info.label}: ${t(config.tooltipKey)}. ${t(info.tooltipKey)}.`;

        return (
          <span
            key={key}
            className="service-status-label"
            style={{ backgroundColor: config.color }}
            title={tooltipText}
            aria-label={tooltipText}
          >
            {info.label}
          </span>
        );
      })}
    </div>
  );
}
