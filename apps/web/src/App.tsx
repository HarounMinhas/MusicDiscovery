import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProviderSwitcher from './components/ProviderSwitcher';
import LoadingIndicator from './components/LoadingIndicator';
import SearchResultsList from './components/SearchResultsList';
import ArtistDetails from './components/ArtistDetails';
import ArtistTabsBar from './components/ArtistTabsBar';
import './styles.css';
import { getSelectedProvider } from './providerSelection';
import { useArtistSearch } from './hooks/useArtistSearch';
import { useArtistDetails } from './hooks/useArtistDetails';
import type { Artist } from '@musicdiscovery/shared';

export default function App(): JSX.Element {
  const [provider] = useState(() => getSelectedProvider());
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef(new Map<number, number>());
  const {
    query,
    results,
    status: searchStatus,
    error: searchError,
    selectedId,
    isPopoverVisible,
    updateQuery,
    focusResults,
    confirmSelection,
    selectArtist
  } = useArtistSearch();

  type OpenTab = {
    id: string;
    name: string;
    imageUrl?: string;
    openedAt: number;
    lastActivatedAt: number;
  };

  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [tabArtists, setTabArtists] = useState<Record<string, Artist>>({});

  const selectedArtist = useMemo(() => {
    if (!activeTabId) {
      return null;
    }
    return tabArtists[activeTabId] ?? null;
  }, [activeTabId, tabArtists]);

  const { status: detailStatus, error: detailError, topTracks, relatedArtists } = useArtistDetails(
    selectedArtist?.id ?? null
  );

  const openOrFocusTab = useCallback((artist: Artist) => {
    setTabArtists((current) => ({
      ...current,
      [artist.id]: artist
    }));
    setOpenTabs((tabs) => {
      const now = Date.now();
      const existing = tabs.find((tab) => tab.id === artist.id);
      if (existing) {
        return tabs.map((tab) =>
          tab.id === artist.id
            ? {
                ...tab,
                name: artist.name,
                imageUrl: artist.imageUrl ?? tab.imageUrl,
                lastActivatedAt: now
              }
            : tab
        );
      }
      return [
        ...tabs,
        {
          id: artist.id,
          name: artist.name,
          imageUrl: artist.imageUrl,
          openedAt: now,
          lastActivatedAt: now
        }
      ];
    });
    setActiveTabId(artist.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setOpenTabs((tabs) => {
      const index = tabs.findIndex((tab) => tab.id === id);
      if (index === -1) {
        return tabs;
      }
      const remaining = [...tabs.slice(0, index), ...tabs.slice(index + 1)];
      setTabArtists((current) => {
        if (!(id in current)) {
          return current;
        }
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setActiveTabId((currentActive) => {
        if (currentActive !== id) {
          return currentActive;
        }
        if (remaining.length === 0) {
          return null;
        }
        const [next] = [...remaining].sort((a, b) => {
          if (b.lastActivatedAt === a.lastActivatedAt) {
            return b.openedAt - a.openedAt;
          }
          return b.lastActivatedAt - a.lastActivatedAt;
        });
        return next.id;
      });
      return remaining;
    });
  }, []);

  const focusTab = useCallback((id: string) => {
    setActiveTabId(id);
    setOpenTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              lastActivatedAt: Date.now()
            }
          : tab
      )
    );
  }, []);

  const handleResultSelect = useCallback(
    (artist: Artist) => {
      selectArtist(artist);
      openOrFocusTab(artist);
    },
    [openOrFocusTab, selectArtist]
  );

  const pushToast = useCallback((message: string) => {
    const text = message.trim();
    if (!text) {
      return;
    }

    setToasts((current) => {
      const id = ++toastIdRef.current;
      const trimmed = current.slice(0, Math.max(0, current.length - 2));
      trimmed.forEach((toast) => {
        const timer = toastTimersRef.current.get(toast.id);
        if (timer) {
          window.clearTimeout(timer);
          toastTimersRef.current.delete(toast.id);
        }
      });
      const next = [...current.slice(-2), { id, message: text }];
      const timeout = window.setTimeout(() => {
        setToasts((existing) => existing.filter((toast) => toast.id !== id));
        toastTimersRef.current.delete(id);
      }, 4200);
      toastTimersRef.current.set(id, timeout);
      return next;
    });
  }, []);

  useEffect(
    () => () => {
      toastTimersRef.current.forEach((timeout) => window.clearTimeout(timeout));
      toastTimersRef.current.clear();
    },
    []
  );

  const lastSearchErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (searchStatus === 'error' && searchError && lastSearchErrorRef.current !== searchError) {
      lastSearchErrorRef.current = searchError;
      pushToast(searchError);
    } else if (searchStatus !== 'error') {
      lastSearchErrorRef.current = null;
    }
  }, [searchError, searchStatus, pushToast]);

  const lastDetailErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (detailStatus === 'error' && detailError && lastDetailErrorRef.current !== detailError) {
      lastDetailErrorRef.current = detailError;
      pushToast(detailError);
    } else if (detailStatus !== 'error') {
      lastDetailErrorRef.current = null;
    }
  }, [detailError, detailStatus, pushToast]);

  return (
    <div className="app">
      <div className="app__toasts" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className="app__toast" role="alert">
            {toast.message}
          </div>
        ))}
      </div>
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
                    const fallback = results[0] ?? null;
                    const targetId = selectedId ?? fallback?.id ?? null;
                    const artist = targetId
                      ? results.find((item) => item.id === targetId) ?? fallback
                      : null;
                    if (artist) {
                      openOrFocusTab(artist);
                    }
                  }
                }}
                placeholder="Bijvoorbeeld: Stromae"
                autoComplete="off"
              />
              <SearchResultsList
                results={results}
                selectedId={selectedId}
                isVisible={isPopoverVisible}
                onSelect={handleResultSelect}
              />
            </div>
          </div>

          {searchStatus === 'idle' && results.length === 0 ? (
            <p className="muted">Begin met typen om artiesten te zoeken.</p>
          ) : null}

          {searchStatus === 'loading' ? <LoadingIndicator label="Resultaten laden…" /> : null}
          {searchStatus === 'error' && searchError ? (
            <p className="sr-only" role="status">
              {searchError}
            </p>
          ) : null}

          {searchStatus === 'success' && results.length === 0 ? (
            <p className="muted">Geen artiesten gevonden voor "{query}".</p>
          ) : null}

        </section>

        <section className="details-panel">
          {openTabs.length > 0 ? (
            <>
              <ArtistTabsBar tabs={openTabs} activeId={activeTabId} onSelect={focusTab} onClose={closeTab} />
              {selectedArtist ? (
                <ArtistDetails
                  artist={selectedArtist}
                  status={detailStatus}
                  topTracks={topTracks}
                  relatedArtists={relatedArtists}
                  error={detailError}
                  provider={provider}
                  onPreviewError={pushToast}
                  onOpenRelated={openOrFocusTab}
                />
              ) : (
                <div className="placeholder">
                  <p className="label">Artiestdetails</p>
                  <p className="muted">Selecteer een artiest om de details te bekijken.</p>
                </div>
              )}
            </>
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
