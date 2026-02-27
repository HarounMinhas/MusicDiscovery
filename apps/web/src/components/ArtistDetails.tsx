import React, { useEffect, useMemo } from 'react';
import type { Artist, ProviderId, Track, ServiceMetadata } from '@musicdiscovery/shared';
import LoadingIndicator from './LoadingIndicator';
import FrequencyVisualizer from './FrequencyVisualizer';
import SimilarArtistsList from './SimilarArtistsList';
import ServiceStatusLabels from './ServiceStatusLabels';
import { useTrackPreview } from '../hooks/useTrackPreview';

interface ArtistDetailsProps {
  artist: Artist;
  status: 'idle' | 'loading' | 'success' | 'error';
  topTracks: Track[];
  relatedArtists: Artist[];
  error: string | null;
  provider: ProviderId;
  serviceMetadata?: ServiceMetadata;
  onPreviewError?: (message: string) => void;
  onOpenRelated?: (artist: Artist) => void;
}

export default function ArtistDetails({
  artist,
  status,
  topTracks,
  relatedArtists,
  error,
  provider,
  serviceMetadata,
  onPreviewError,
  onOpenRelated
}: ArtistDetailsProps) {
  const previewEnabled = provider === 'tokenless';
  const {
    activeTrackId,
    audioRef: previewAudioRef,
    error: previewError,
    failure: previewFailure,
    togglePreview,
    stopPlayback
  } = useTrackPreview(
    previewEnabled,
    onPreviewError
  );

  useEffect(() => {
    stopPlayback();
  }, [artist.id, provider, stopPlayback]);

  useEffect(() => {
    if (!activeTrackId) {
      return;
    }
    if (!topTracks.some((track) => track.id === activeTrackId)) {
      stopPlayback();
    }
  }, [activeTrackId, topTracks, stopPlayback]);

  const displayTopTracks = useMemo(() => topTracks.slice(0, 5), [topTracks]);
  const displayRelated = useMemo(() => relatedArtists.slice(0, 8), [relatedArtists]);
  const activePreviewFailure = useMemo(() => {
    if (!previewFailure) {
      return null;
    }
    return displayTopTracks.some((track) => track.id === previewFailure.track.id)
      ? previewFailure
      : null;
  }, [displayTopTracks, previewFailure]);

  return (
    <div className="artist-details">
      <header>
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt="" />
        ) : (
          <div className="avatar-placeholder" aria-hidden="true">
            {artist.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="label">Geselecteerde artiest</p>
          <div className="artist-header-title">
            <h2>{artist.name}</h2>
            <ServiceStatusLabels metadata={serviceMetadata} />
          </div>
          {artist.genres?.length ? <p className="muted">{artist.genres.slice(0, 3).join(', ')}</p> : null}
        </div>
      </header>

      {status === 'loading' && <LoadingIndicator label="Artiestdetails laden…" />}
      {status === 'error' && error ? (
        <p className="sr-only" role="status">
          {error}
        </p>
      ) : null}

      {status !== 'loading' && status !== 'error' ? (
        <div className="details-grid">
          <section>
            <h3>Topnummers</h3>
            {displayTopTracks.length === 0 ? (
              <p className="muted">Geen topnummers gevonden.</p>
            ) : previewEnabled ? (
              <>
                <ol className="track-list track-list--interactive">
                  {displayTopTracks.map((track) => {
                    const isActive = activeTrackId === track.id;
                    const canPreview = Boolean(track.previewProxyUrl ?? track.previewUrl);
                    const playIconClass = isActive
                      ? 'track-list__icon track-list__icon--play track-list__icon--hidden'
                      : 'track-list__icon track-list__icon--play';
                    const stopIconClass = isActive
                      ? 'track-list__icon track-list__icon--stop'
                      : 'track-list__icon track-list__icon--stop track-list__icon--hidden';
                    return (
                      <li key={track.id}>
                        <button
                          type="button"
                          className={`track-list__button${isActive ? ' is-playing' : ''}`}
                          onClick={() => togglePreview(track)}
                          disabled={!canPreview}
                          aria-pressed={isActive}
                          aria-label={
                            isActive
                              ? `Stop preview van ${track.name}`
                              : `Speel preview van ${track.name}`
                          }
                        >
                          <span
                            className={`track-list__visualizer${isActive ? ' is-active' : ''}`}
                            aria-hidden="true"
                          >
                            <span className="track-list__visualizer-overlay" />
                            {isActive ? (
                              <FrequencyVisualizer
                                audioRef={previewAudioRef}
                                fftSize={1024}
                                smoothing={0.86}
                                barColor="rgba(255, 255, 255, 0.55)"
                              />
                            ) : null}
                          </span>
                          <div className="track-list__meta">
                            <strong>{track.name}</strong>
                            <span className="muted">{formatArtists(track)}</span>
                          </div>
                          <div className="track-list__actions">
                            <span className="muted track-list__duration">
                              {formatDuration(track.durationMs)}
                            </span>
                            {canPreview ? (
                              <span className="track-list__indicator" aria-hidden="true">
                                <span className={playIconClass}>
                                  ▶
                                </span>
                                <span className={stopIconClass}>
                                  ■
                                </span>
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {previewError || activePreviewFailure ? (
                  <div className="track-list__error" role="status" aria-live="polite">
                    {previewError ? <p>{previewError}</p> : null}
                    {activePreviewFailure ? (
                      <dl className="track-list__error-meta">
                        {activePreviewFailure.details.status ? (
                          <>
                            <dt>Status</dt>
                            <dd>{activePreviewFailure.details.status}</dd>
                          </>
                        ) : null}
                        {activePreviewFailure.details.deezerReference ? (
                          <>
                            <dt>Referentie</dt>
                            <dd>{activePreviewFailure.details.deezerReference}</dd>
                          </>
                        ) : null}
                        {activePreviewFailure.details.deezerIp ? (
                          <>
                            <dt>Deezer IP</dt>
                            <dd>{activePreviewFailure.details.deezerIp}</dd>
                          </>
                        ) : null}
                      </dl>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <ol className="track-list">
                {displayTopTracks.map((track) => (
                  <li key={track.id}>
                    <div>
                      <strong>{track.name}</strong>
                      <span className="muted">{formatArtists(track)}</span>
                    </div>
                    <span className="muted">{formatDuration(track.durationMs)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section>
            <h3>Gerelateerde artiesten</h3>
            {displayRelated.length === 0 ? (
              <p className="muted">
                Geen gerelateerde artiesten gevonden. Dit komt zelden voor maar is belangrijk. Stuur de
                naam van de artiest waar u naar zocht naar{' '}
                <a href="mailto:myemail@gmail.com">myemail@gmail.com</a>.
              </p>
            ) : (
              <SimilarArtistsList artists={displayRelated} onOpen={onOpenRelated} />
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatArtists(track: Track) {
  if (!track.artists?.length) {
    return 'Onbekende artiest';
  }
  return track.artists.map((item) => item.name).join(', ');
}
