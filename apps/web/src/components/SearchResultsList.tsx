import React from 'react';
import type { Artist } from '@musicdiscovery/shared';

interface SearchResultsListProps {
  results: Artist[];
  selectedId: string | null;
  onSelect: (artist: Artist) => void;
  isVisible: boolean;
}

export default function SearchResultsList({ results, selectedId, onSelect, isVisible }: SearchResultsListProps) {
  if (!isVisible || results.length === 0) {
    return null;
  }

  return (
    <div className="results-popover" role="listbox">
      <ul className="results-list">
        {results.map((artist) => {
          const isActive = selectedId === artist.id;
          return (
            <li key={artist.id} className={isActive ? 'active' : undefined}>
              <button
                type="button"
                onClick={() => onSelect(artist)}
                role="option"
                aria-selected={isActive}
              >
                {artist.imageUrl ? (
                  <img src={artist.imageUrl} alt="" loading="lazy" />
                ) : (
                  <div className="avatar-placeholder" aria-hidden="true">
                    {artist.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="meta">
                  <strong>{artist.name}</strong>
                  {artist.genres?.length ? (
                    <span className="muted">{artist.genres.slice(0, 2).join(', ')}</span>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
