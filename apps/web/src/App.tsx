import React, { useState } from 'react';
import ProviderSwitcher from './components/ProviderSwitcher';
import LoadingIndicator from './components/LoadingIndicator';
import SearchResultsList from './components/SearchResultsList';
import ArtistDetails from './components/ArtistDetails';
import './styles.css';
import { getSelectedProvider } from './providerSelection';
import { useArtistSearch } from './hooks/useArtistSearch';
import { useArtistDetails } from './hooks/useArtistDetails';

export default function App(): JSX.Element {
  const [provider] = useState(() => getSelectedProvider());
  const {
    query,
    results,
    status: searchStatus,
    error: searchError,
    selectedId,
    selectedArtist,
    isPopoverVisible,
    updateQuery,
    focusResults,
    confirmSelection,
    selectArtist
  } = useArtistSearch();

  const { status: detailStatus, error: detailError, topTracks, relatedArtists } = useArtistDetails(
    selectedArtist?.id ?? null
  );

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="label">MusicDiscovery</p>
          <h1>Ontdek nieuwe artiesten</h1>
          <p className="muted">
            Zoek cross-provider en bekijk meteen de populairste nummers en gerelateerde artiesten.
          </p>
        </div>
        <ProviderSwitcher />
      </header>

      <main className="app__body">
        <section className="search-panel">
          <div className="search-panel__input">
            <label htmlFor="artist-search" className="label">
              Zoek naar een artiest
            </label>
            <div className="search-panel__input-wrapper">
              <input
                id="artist-search"
                value={query}
                onChange={(event) => {
                  updateQuery(event.target.value);
                }}
                onFocus={() => {
                  focusResults();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    confirmSelection();
                  }
                }}
                placeholder="Bijvoorbeeld: Stromae"
                autoComplete="off"
              />
              <SearchResultsList
                results={results}
                selectedId={selectedId}
                isVisible={isPopoverVisible}
                onSelect={selectArtist}
              />
            </div>
          </div>

          {searchStatus === 'idle' && results.length === 0 ? (
            <p className="muted">Begin met typen om artiesten te zoeken.</p>
          ) : null}

          {searchStatus === 'loading' ? <LoadingIndicator label="Resultaten laden…" /> : null}
          {searchStatus === 'error' && searchError ? <p className="error">{searchError}</p> : null}

          {searchStatus === 'success' && results.length === 0 ? (
            <p className="muted">Geen artiesten gevonden voor "{query}".</p>
          ) : null}

        </section>

        <section className="details-panel">
          {selectedArtist ? (
            <ArtistDetails
              artist={selectedArtist}
              status={detailStatus}
              topTracks={topTracks}
              relatedArtists={relatedArtists}
              error={detailError}
              provider={provider}
            />
          ) : (
            <div className="placeholder">
              <p className="label">Artiestdetails</p>
              <p className="muted">Selecteer een artiest om de details te bekijken.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
