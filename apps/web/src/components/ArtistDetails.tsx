import React from 'react';
import type { Artist, Track } from '@musicdiscovery/shared';
import LoadingIndicator from './LoadingIndicator';

interface ArtistDetailsProps {
  artist: Artist;
  status: 'idle' | 'loading' | 'success' | 'error';
  topTracks: Track[];
  relatedArtists: Artist[];
  error: string | null;
}

export default function ArtistDetails({ artist, status, topTracks, relatedArtists, error }: ArtistDetailsProps) {
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
