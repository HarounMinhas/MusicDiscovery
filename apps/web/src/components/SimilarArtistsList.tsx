import React from 'react';
import type { Artist } from '@musicdiscovery/shared';

interface SimilarArtistsListProps {
  artists: Artist[];
  onOpen?: (artist: Artist) => void;
}

export default function SimilarArtistsList({ artists, onOpen }: SimilarArtistsListProps) {
  if (artists.length === 0) {
    return null;
  }

  return (
    <ul className="related-list">
      {artists.map((artist) => (
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
          </button>
        </li>
      ))}
    </ul>
  );
}
