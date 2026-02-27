import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { Artist, ProviderId, ProviderMetadata, Track, ServiceMetadata } from '@musicdiscovery/shared';

import ArtistDetails from './components/ArtistDetails';
import ArtistTabsBar, { type ArtistTabItem } from './components/ArtistTabsBar';
import LoadingIndicator from './components/LoadingIndicator';
import ProviderSwitcher from './components/ProviderSwitcher';
import SearchResultsList from './components/SearchResultsList';
import type { AsyncStatus } from './hooks/useArtistSearch';
import type { ProviderStatus } from './hooks/useProviderSelection';
import type { ToastMessage } from './hooks/useToastQueue';
import { useI18n } from './i18n';

interface HeaderProps {
  provider: ProviderId;
  providerOptions: ProviderMetadata[];
  providerStatus: ProviderStatus;
  providerError: string | null;
  onProviderChange: (provider: ProviderId) => void;
  onOpenSettings: () => void;
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
  serviceMetadata?: ServiceMetadata;
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

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.65l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,12.79,1H11.21a.5.5,0,0,0-.49.42L10.34,4.07a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.65L5.86,11.06a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L3.75,14.59a.5.5,0,0,0-.12.65l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.49.42h1.58a.5.5,0,0,0,.49-.42l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.65ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
      />
    </svg>
  );
}

function HomeRoute({ header, search, tabs, detail, toasts }: AppRoutesProps) {
  const { t } = useI18n();

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
        <div className="app__header-content">
          <div className="app__header-top">
            <p className="label">{t('app.brand')}</p>
            <button
              type="button"
              className="settings-button"
              aria-label={t('app.openSettings')}
              onClick={header.onOpenSettings}
            >
              <GearIcon />
            </button>
          </div>
          <h1>{t('home.title')}</h1>
          <p className="muted">{t('home.subtitle')}</p>
        </div>
        <div className="app__header-controls">
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
              {t('search.label')}
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
                placeholder={t('search.placeholder')}
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

          {search.status === 'idle' && search.results.length === 0 ? <p className="muted">{t('search.idle')}</p> : null}

          {search.status === 'loading' ? <LoadingIndicator label={t('search.loading')} /> : null}
          {search.status === 'error' && search.error ? (
            <p className="sr-only" role="status">
              {search.error}
            </p>
          ) : null}

          {search.status === 'success' && search.results.length === 0 ? (
            <p className="muted">{t('search.noResults', { query: search.query })}</p>
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
                  serviceMetadata={detail.serviceMetadata}
                  error={detail.error}
                  provider={detail.provider}
                  onPreviewError={detail.onPreviewError}
                  onOpenRelated={detail.onOpenRelated}
                />
              ) : (
                <div className="placeholder">
                  <p className="label">{t('details.title')}</p>
                  <p className="muted">{t('details.empty')}</p>
                </div>
              )}
            </>
          ) : (
            <div className="placeholder">
              <p className="label">{t('details.title')}</p>
              <p className="muted">{t('details.empty')}</p>
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
