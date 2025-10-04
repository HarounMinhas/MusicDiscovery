import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Artist, ProviderId, Track } from '@musicdiscovery/shared';
import LoadingIndicator from './LoadingIndicator';

interface ArtistDetailsProps {
  artist: Artist;
  status: 'idle' | 'loading' | 'success' | 'error';
  topTracks: Track[];
  relatedArtists: Artist[];
  error: string | null;
  provider: ProviderId;
}

export default function ArtistDetails({
  artist,
  status,
  topTracks,
  relatedArtists,
  error,
  provider
}: ArtistDetailsProps) {
  const previewEnabled = provider === 'tokenless';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const stopPlayback = useCallback(() => {
    const current = audioRef.current;
    if (current) {
      current.pause();
      current.currentTime = 0;
    }
    audioRef.current = null;
    setActiveTrackId(null);
  }, []);

  const togglePreview = useCallback(
    (track: Track) => {
      if (!previewEnabled || !track.previewUrl) {
        return;
      }

      if (track.id === activeTrackId) {
        stopPlayback();
        return;
      }

      stopPlayback();

      const audio = new Audio(track.previewUrl);
      audioRef.current = audio;
      setActiveTrackId(track.id);

      const handleEnded = () => {
        stopPlayback();
      };

      audio.addEventListener('ended', handleEnded, { once: true });
      audio.play().catch(() => {
        stopPlayback();
      });
    },
    [activeTrackId, previewEnabled, stopPlayback]
  );

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

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
          <h2>{artist.name}</h2>
          {artist.genres?.length ? <p className="muted">{artist.genres.slice(0, 3).join(', ')}</p> : null}
        </div>
      </header>

      {status === 'loading' && <LoadingIndicator label="Artiestdetails laden…" />}
      {status === 'error' && error ? <p className="error">{error}</p> : null}

      {status !== 'loading' && status !== 'error' ? (
        <div className="details-grid">
          <section>
            <h3>Topnummers</h3>
            {topTracks.length === 0 ? (
              <p className="muted">Geen topnummers gevonden.</p>
            ) : previewEnabled ? (
              <ol className="track-list track-list--interactive">
                {topTracks.slice(0, 5).map((track) => {
                  const isActive = activeTrackId === track.id;
                  const canPreview = Boolean(track.previewUrl);
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
                        <div className="track-list__meta">
                          <strong>{track.name}</strong>
                          <span className="muted">{formatArtists(track)}</span>
                        </div>
                        <div className="track-list__actions">
                          <span className="muted track-list__duration">
                            {formatDuration(track.durationMs)}
                          </span>
                          {canPreview ? (
                            <span className="track-list__icon" aria-hidden="true">
                              {isActive ? '■' : '▶'}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <ol className="track-list">
                {topTracks.slice(0, 5).map((track) => (
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
            {relatedArtists.length === 0 ? (
              <p className="muted">Geen gerelateerde artiesten gevonden.</p>
            ) : (
              <ul className="related-list">
                {relatedArtists.slice(0, 8).map((item) => (
                  <li key={item.id}>{item.name}</li>
                ))}
              </ul>
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
