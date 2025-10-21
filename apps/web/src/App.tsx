import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Artist, ProviderId } from '@musicdiscovery/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import ProviderSwitcher from './components/ProviderSwitcher';
import LoadingIndicator from './components/LoadingIndicator';
import SearchResultsList from './components/SearchResultsList';
import ArtistDetails from './components/ArtistDetails';
import ArtistTabsBar, { type ArtistTabItem } from './components/ArtistTabsBar';
import BackgroundToggle, { type BackgroundMode } from './components/BackgroundToggle';
import BackgroundPulse from './components/BackgroundPulse';
import './styles.css';
import { getSelectedProvider, setSelectedProvider } from './providerSelection';
import { useArtistSearch } from './hooks/useArtistSearch';
import { useArtistDetails } from './hooks/useArtistDetails';
import { useScrollPreserver } from './hooks/useScrollPreserver';

export default function App(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<ProviderId>(() => getSelectedProvider());
  const preserveScroll = useScrollPreserver();
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('background-mode');
      if (stored === 'static' || stored === 'animated') {
        return stored;
      }
    }
    return 'static';
  });
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef(new Map<number, number>());
  const {
    query,
    results,
    status: searchStatus,
    error: searchError,
    selectedId,
    highlightedArtist,
    confirmedArtist,
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
    artist: Artist;
    openedAt: number;
    lastActivatedAt: number;
  };

  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const lastHistoryArtistIdRef = useRef<string | null>(null);
  const currentArtistId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('artistId');
  }, [location.search]);

  useEffect(() => {
    lastHistoryArtistIdRef.current = currentArtistId;
  }, [currentArtistId]);

  const updateUrlForArtist = useCallback(
    (artistId: string | null) => {
      if (lastHistoryArtistIdRef.current === artistId && currentArtistId === artistId) {
        return;
      }

      const params = new URLSearchParams(location.search);
      if (artistId) {
        params.set('artistId', artistId);
      } else {
        params.delete('artistId');
      }

      const search = params.toString();
      const hash = location.hash || '';
      const nextUrl = `${location.pathname}${search ? `?${search}` : ''}${hash}`;
      navigate(nextUrl, { preventScrollReset: true });
      lastHistoryArtistIdRef.current = artistId;
    },
    [currentArtistId, location.hash, location.pathname, location.search, navigate]
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const { body, documentElement } = document;
    body.dataset.background = backgroundMode;
    documentElement.dataset.background = backgroundMode;

    return () => {
      delete body.dataset.background;
      delete documentElement.dataset.background;
    };
  }, [backgroundMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('background-mode', backgroundMode);
  }, [backgroundMode]);

  const handleProviderChange = useCallback(
    (next: ProviderId) => {
      setSelectedProvider(next);
      if (next === provider) {
        return;
      }

      preserveScroll(() => {
        setProvider(next);
        setOpenTabs([]);
        setActiveTabId(null);
        lastHistoryArtistIdRef.current = null;
        handledConfirmedArtistRef.current = null;
        updateUrlForArtist(null);
      });
    },
    [preserveScroll, provider, updateUrlForArtist]
  );

  const openOrFocusTab = useCallback(
    (artist: Artist) => {
      preserveScroll(() => {
        const now = Date.now();
        setOpenTabs((tabs) => {
          const existing = tabs.find((tab) => tab.id === artist.id);
          if (existing) {
            return tabs.map((tab) =>
              tab.id === artist.id
                ? {
                    ...tab,
                    name: artist.name,
                    imageUrl: artist.imageUrl,
                    artist,
                    lastActivatedAt: now
                  }
                : tab
            );
          }

          const nextTab: OpenTab = {
            id: artist.id,
            name: artist.name,
            imageUrl: artist.imageUrl,
            artist,
            openedAt: now,
            lastActivatedAt: now
          };
          return [...tabs, nextTab];
        });
        setActiveTabId(artist.id);
        updateUrlForArtist(artist.id);
      });
    },
    [preserveScroll, updateUrlForArtist]
  );

  const focusTab = useCallback(
    (id: string) => {
      preserveScroll(() => {
        setActiveTabId(id);
        setOpenTabs((tabs) =>
          tabs.map((tab) => (tab.id === id ? { ...tab, lastActivatedAt: Date.now() } : tab))
        );
        updateUrlForArtist(id);
      });
    },
    [preserveScroll, updateUrlForArtist]
  );

  const closeTab = useCallback(
    (id: string) => {
      preserveScroll(() => {
        let nextActiveId: string | null = null;
        setOpenTabs((tabs) => {
          const remaining = tabs.filter((tab) => tab.id !== id);
          if (remaining.length === tabs.length) {
            nextActiveId = activeTabId ?? null;
            return tabs;
          }
          if (activeTabId && activeTabId !== id) {
            nextActiveId = activeTabId;
            return remaining;
          }

          if (remaining.length === 0) {
            nextActiveId = null;
            return remaining;
          }

          const next = remaining.reduce((latest, tab) =>
            tab.lastActivatedAt > latest.lastActivatedAt ? tab : latest
          );
          nextActiveId = next.id;
          return remaining;
        });

        setActiveTabId(nextActiveId);
        updateUrlForArtist(nextActiveId);
      });
    },
    [activeTabId, preserveScroll, updateUrlForArtist]
  );

  const handledConfirmedArtistRef = useRef<string | null>(null);

  useEffect(() => {
    if (!confirmedArtist) {
      handledConfirmedArtistRef.current = null;
      return;
    }

    if (handledConfirmedArtistRef.current === confirmedArtist.id) {
      return;
    }

    handledConfirmedArtistRef.current = confirmedArtist.id;
    openOrFocusTab(confirmedArtist);
  }, [confirmedArtist, openOrFocusTab]);

  useEffect(() => {
    if (currentArtistId === activeTabId) {
      return;
    }

    if (!currentArtistId) {
      if (activeTabId !== null) {
        preserveScroll(() => {
          setActiveTabId(null);
        });
      }
      return;
    }

    if (lastHistoryArtistIdRef.current !== currentArtistId) {
      return;
    }

    const matchingTab = openTabs.find((tab) => tab.id === currentArtistId);
    if (!matchingTab) {
      return;
    }

    preserveScroll(() => {
      setActiveTabId(currentArtistId);
      setOpenTabs((tabs) =>
        tabs.map((tab) =>
          tab.id === currentArtistId
            ? { ...tab, lastActivatedAt: Date.now() }
            : tab
        )
      );
    });
  }, [activeTabId, currentArtistId, openTabs, preserveScroll]);

  const {
    status: detailStatus,
    error: detailError,
    artist: detailArtist,
    topTracks,
    relatedArtists
  } = useArtistDetails(activeTabId, provider);

  const activeTab = useMemo(
    () => (activeTabId ? openTabs.find((tab) => tab.id === activeTabId) ?? null : null),
    [activeTabId, openTabs]
  );

  useEffect(() => {
    if (!detailArtist) {
      return;
    }

    setOpenTabs((tabs) => {
      let mutated = false;
      const next = tabs.map((tab) => {
        if (tab.id !== detailArtist.id) {
          return tab;
        }
        if (tab.artist === detailArtist) {
          return tab;
        }
        mutated = true;
        return {
          ...tab,
          name: detailArtist.name,
          imageUrl: detailArtist.imageUrl,
          artist: detailArtist
        };
      });
      return mutated ? next : tabs;
    });
  }, [detailArtist]);

  const selectedArtist = detailArtist ?? activeTab?.artist ?? null;

  const tabItems = useMemo<ArtistTabItem[]>(
    () => openTabs.map(({ id, name, imageUrl }) => ({ id, name, imageUrl })),
    [openTabs]
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
      {backgroundMode === 'animated' ? <BackgroundPulse /> : null}
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
        <div className="app__header-controls">
          <BackgroundToggle value={backgroundMode} onChange={setBackgroundMode} />
          <ProviderSwitcher value={provider} onChange={handleProviderChange} />
        </div>
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
                    if (highlightedArtist) {
                      openOrFocusTab(highlightedArtist);
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
                onSelect={(artist) => {
                  selectArtist(artist);
                  openOrFocusTab(artist);
                }}
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
              <ArtistTabsBar tabs={tabItems} activeId={activeTabId} onSelect={focusTab} onClose={closeTab} />
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
