import React from 'react';
import type { Artist } from '@musicdiscovery/shared';

interface SimilarArtistsListProps {
  artists: Artist[];
  onOpen?: (artist: Artist) => void;
}

function sourceTag(source?: string): string | null {
  switch ((source ?? '').toLowerCase()) {
    case 'deezer':
      return 'Deezer';
    case 'lastfm':
      return 'Last.fm';
    case 'musicbrainz':
      return 'MusicBrainz';
    case 'discogs':
      return 'Discogs';
    default:
      return null;
  }
}

export default function SimilarArtistsList({ artists, onOpen }: SimilarArtistsListProps) {
  if (artists.length === 0) {
    return null;
  }

  return (
    <ul className="related-list">
      {artists.map((artist) => {
        const tag = sourceTag(artist.uxSource);
        return (
          <li key={artist.id}>
            <button
              type="button"
              className="related-list__button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpen?.(artist);
              }}
            >
              {artist.imageUrl ? (
                <img className="related-list__thumb" src={artist.imageUrl} alt="" />
              ) : (
                <div className="related-list__thumb related-list__thumb--placeholder" aria-hidden="true">
                  {artist.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="related-list__label">{artist.name}</span>
              {tag ? <span className="related-list__source">{tag}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
