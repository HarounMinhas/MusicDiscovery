import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { Artist, ProviderId, ProviderMetadata, Track } from '@musicdiscovery/shared';

import ArtistDetails from './components/ArtistDetails';
import ArtistTabsBar, { type ArtistTabItem } from './components/ArtistTabsBar';
import BackgroundToggle, { type BackgroundMode } from './components/BackgroundToggle';
import LoadingIndicator from './components/LoadingIndicator';
import ProviderSwitcher from './components/ProviderSwitcher';
import SearchResultsList from './components/SearchResultsList';
import type { AsyncStatus } from './hooks/useArtistSearch';
import type { ProviderStatus } from './hooks/useProviderSelection';
import type { ToastMessage } from './hooks/useToastQueue';

interface HeaderProps {
  provider: ProviderId;
  providerOptions: ProviderMetadata[];
  providerStatus: ProviderStatus;
  providerError: string | null;
  onProviderChange: (provider: ProviderId) => void;
  backgroundMode: BackgroundMode;
  onBackgroundModeChange: (mode: BackgroundMode) => void;
}

interface SearchProps {
  query: string;
  results: Artist[];
  status: AsyncStatus;
  error: string | null;
  selectedId: string | null;
  highlightedArtist: Artist | null;
  isPopoverVisible: boolean;
  onQueryChange: (value: string) => void;
  onFocusResults: () => void;
  onConfirmSelection: () => void;
  onSelectArtist: (artist: Artist) => void;
  onOpenArtist: (artist: Artist) => void;
}

interface TabsProps {
  items: ArtistTabItem[];
  activeId: string | null;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  hasTabs: boolean;
}

interface DetailProps {
  provider: ProviderId;
  status: AsyncStatus;
  error: string | null;
  selectedArtist: Artist | null;
  topTracks: Track[];
  relatedArtists: Artist[];
  onPreviewError: (message: string) => void;
  onOpenRelated: (artist: Artist) => void;
}

interface AppRoutesProps {
  header: HeaderProps;
  search: SearchProps;
  tabs: TabsProps;
  detail: DetailProps;
  toasts: ToastMessage[];
}

function HomeRoute({ header, search, tabs, detail, toasts }: AppRoutesProps) {
  return (
    <>
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
          <BackgroundToggle value={header.backgroundMode} onChange={header.onBackgroundModeChange} />
          <ProviderSwitcher
            value={header.provider}
            status={header.providerStatus}
            error={header.providerError}
            options={header.providerOptions}
            onChange={header.onProviderChange}
          />
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
                value={search.query}
                onChange={(event) => search.onQueryChange(event.target.value)}
                onFocus={search.onFocusResults}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    search.onConfirmSelection();
                    if (search.highlightedArtist) {
                      search.onOpenArtist(search.highlightedArtist);
                    }
                  }
                }}
                placeholder="Bijvoorbeeld: Stromae"
                autoComplete="off"
              />
              <SearchResultsList
                results={search.results}
                selectedId={search.selectedId}
                isVisible={search.isPopoverVisible}
                onSelect={(artist) => {
                  search.onSelectArtist(artist);
                  search.onOpenArtist(artist);
                }}
              />
            </div>
          </div>

          {search.status === 'idle' && search.results.length === 0 ? (
            <p className="muted">Begin met typen om artiesten te zoeken.</p>
          ) : null}

          {search.status === 'loading' ? <LoadingIndicator label="Resultaten laden…" /> : null}
          {search.status === 'error' && search.error ? (
            <p className="sr-only" role="status">
              {search.error}
            </p>
          ) : null}

          {search.status === 'success' && search.results.length === 0 ? (
            <p className="muted">Geen artiesten gevonden voor "{search.query}".</p>
          ) : null}
        </section>

        <section className="details-panel">
          {tabs.hasTabs ? (
            <>
              <ArtistTabsBar tabs={tabs.items} activeId={tabs.activeId} onSelect={tabs.onFocus} onClose={tabs.onClose} />
              {detail.selectedArtist ? (
                <ArtistDetails
                  artist={detail.selectedArtist}
                  status={detail.status}
                  topTracks={detail.topTracks}
                  relatedArtists={detail.relatedArtists}
                  error={detail.error}
                  provider={detail.provider}
                  onPreviewError={detail.onPreviewError}
                  onOpenRelated={detail.onOpenRelated}
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
    </>
  );
}

export default function AppRoutes(props: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute {...props} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
