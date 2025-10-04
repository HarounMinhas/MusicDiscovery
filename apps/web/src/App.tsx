import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Artist, Track } from '@musicdiscovery/shared';
import { getRelatedArtists, getTopTracks, searchArtists } from './api';
import ProviderSwitcher from './components/ProviderSwitcher';
import LoadingIndicator from './components/LoadingIndicator';
import SearchResultsList from './components/SearchResultsList';
import ArtistDetails from './components/ArtistDetails';
import './styles.css';
import { getSelectedProvider } from './providerSelection';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';
type DetailStatus = 'idle' | 'loading' | 'success' | 'error';

export default function App(): JSX.Element {
  const [query, setQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<Artist[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const isManuallyHiddenRef = useRef(isManuallyHidden);

  useEffect(() => {
    isManuallyHiddenRef.current = isManuallyHidden;
  }, [isManuallyHidden]);

  const [provider] = useState(() => getSelectedProvider());

  const [detailStatus, setDetailStatus] = useState<DetailStatus>('idle');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>([]);

  const selectedArtist = useMemo(
    () => (selectedId ? results.find((item) => item.id === selectedId) ?? null : null),
    [results, selectedId]
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchStatus('idle');
      setSearchError(null);
      setSelectedId(null);
      setIsResultsOpen(false);
      setIsManuallyHidden(false);
      return;
    }

    let cancelled = false;
    setSearchStatus('loading');
    setSearchError(null);

    const debounce = window.setTimeout(() => {
      searchArtists(query.trim(), 10)
        .then((items) => {
          if (cancelled) return;
          setResults(items);
          setSearchStatus('success');
          setIsResultsOpen(items.length > 0 && !isManuallyHiddenRef.current);
          if (items.length === 0) {
            setSelectedId(null);
          } else if (!items.some((item) => item.id === selectedId)) {
            setSelectedId(items[0]?.id ?? null);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setSearchStatus('error');
          setSearchError(err instanceof Error ? err.message : String(err));
          setResults([]);
          setIsResultsOpen(false);
          setIsManuallyHidden(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [query, selectedId]);

  useEffect(() => {
    if (!selectedArtist) {
      setDetailStatus('idle');
      setDetailError(null);
      setTopTracks([]);
      setRelatedArtists([]);
      return;
    }

    let cancelled = false;
    setDetailStatus('loading');
    setDetailError(null);

    Promise.all([getTopTracks(selectedArtist.id, undefined, 5), getRelatedArtists(selectedArtist.id, 8)])
      .then(([tracks, related]) => {
        if (cancelled) return;
        setTopTracks(tracks);
        setRelatedArtists(related);
        setDetailStatus('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailStatus('error');
        setDetailError(err instanceof Error ? err.message : String(err));
        setTopTracks([]);
        setRelatedArtists([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedArtist?.id]);

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
                  setQuery(event.target.value);
                  setIsManuallyHidden(false);
                  setIsResultsOpen(true);
                }}
                onFocus={() => {
                  if (results.length > 0) {
                    setIsManuallyHidden(false);
                    setIsResultsOpen(true);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!selectedId && results[0]) {
                      setSelectedId(results[0].id);
                    }
                    setIsManuallyHidden(true);
                    setIsResultsOpen(false);
                  }
                }}
                placeholder="Bijvoorbeeld: Stromae"
                autoComplete="off"
              />
              <SearchResultsList
                results={results}
                selectedId={selectedId}
                isVisible={isResultsOpen && results.length > 0}
                onSelect={(artist) => {
                  setSelectedId(artist.id);
                  setIsManuallyHidden(true);
                  setIsResultsOpen(false);
                }}
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
