import React from 'react';
import type { ServiceMetadata, ServiceStatus } from '@musicdiscovery/shared';

interface ServiceStatusLabelsProps {
  metadata?: ServiceMetadata;
}

interface ServiceInfo {
  label: string;
  tooltip: string;
}

const SERVICE_INFO: Record<string, ServiceInfo> = {
  deezer: {
    label: 'Deezer',
    tooltip: 'Primaire muziekservice voor audio-gelijkenis'
  },
  lastfm: {
    label: 'Last.fm',
    tooltip: 'Muziekdatabase met gebruikersluisterdata'
  },
  musicbrainz: {
    label: 'MusicBrainz',
    tooltip: 'Open muziekencyclopedie met artiestrelatiedata'
  },
  discogs: {
    label: 'Discogs',
    tooltip: 'Muziekdatabase met catalogus- en samenwerkingsdata'
  }
};

const STATUS_CONFIG: Record<ServiceStatus, { color: string; tooltip: string }> = {
  success: {
    color: '#22c55e',
    tooltip: 'Resultaten gevonden'
  },
  empty: {
    color: '#ef4444',
    tooltip: 'Geen resultaten gevonden'
  },
  error: {
    color: '#ef4444',
    tooltip: 'Fout opgetreden bij ophalen'
  },
  unused: {
    color: '#d1d5db',
    tooltip: 'Niet gebruikt (primaire service had al resultaten)'
  },
  'rate-limited': {
    color: '#f59e0b',
    tooltip: 'Rate-limit bereikt, tijdelijk overgeslagen'
  }
};

export default function ServiceStatusLabels({ metadata }: ServiceStatusLabelsProps) {
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
    <div className="service-status-labels" aria-label="Status van muziekservices">
      {services.map(({ key, status }) => {
        const info = SERVICE_INFO[key];
        const config = STATUS_CONFIG[status];
        
        if (!info || !config) return null;

        const tooltipText = `${info.label}: ${config.tooltip}. ${info.tooltip}.`;

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
