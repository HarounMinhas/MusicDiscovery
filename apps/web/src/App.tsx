import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProviderId } from '@musicdiscovery/shared';

import AppRoutes from './AppRoutes';
import BackgroundSurface from './components/BackgroundSurface';
import BackgroundToggle, { type BackgroundMode } from './components/BackgroundToggle';
import ServerStatusOverlay from './components/ServerStatusOverlay';
import ThemeToggle, { type ThemeMode } from './components/ThemeToggle';
import './styles.css';
import { useArtistDetails } from './hooks/useArtistDetails';
import { useArtistSearch } from './hooks/useArtistSearch';
import { useProviderSelection } from './hooks/useProviderSelection';
import { useServerStatus } from './hooks/useServerStatus';
import { useTabState } from './hooks/useTabState';
import { useToastQueue } from './hooks/useToastQueue';
import { useScrollPreserver } from './hooks/useScrollPreserver';
import { I18nProvider, useI18n, type Lang } from './i18n';

const INTRO_ACK_KEY = 'musicdiscovery-intro-acknowledged';
const THEME_KEY = 'musicdiscovery-theme';

function AppInner(): JSX.Element {
  const preserveScroll = useScrollPreserver();
  const { toasts, pushToast } = useToastQueue();
  const { t, lang, setLang } = useI18n();
  const serverStatus = useServerStatus();

  const {
    provider,
    providers,
    status: providerStatus,
    error: providerError,
    selectProvider
  } = useProviderSelection();
  const {
    tabs,
    tabItems,
    activeTab,
    activeTabId,
    openOrFocus,
    focusTab,
    closeTab,
    clearTabs,
    updateTabArtist
  } = useTabState({ preserveScroll });
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
  const {
    status: detailStatus,
    error: detailError,
    artist: detailArtist,
    topTracks,
    relatedArtists,
    serviceMetadata
  } = useArtistDetails(activeTabId, provider);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.theme = theme;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme);
    }

    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('background-mode');
      if (stored === 'static' || stored === 'animated') {
        return stored;
      }
    }
    return 'animated';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('background-mode', backgroundMode);
    }
  }, [backgroundMode]);

  const [isIntroOpen, setIsIntroOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(INTRO_ACK_KEY) !== 'true';
  });

  const acknowledgeIntro = useCallback(() => {
    setIsIntroOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INTRO_ACK_KEY, 'true');
    }
  }, []);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSettings();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [isSettingsOpen, closeSettings]);

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
    openOrFocus(confirmedArtist);
  }, [confirmedArtist, openOrFocus]);

  useEffect(() => {
    if (detailArtist) {
      updateTabArtist(detailArtist);
    }
  }, [detailArtist, updateTabArtist]);

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

  const handleProviderChange = useCallback(
    (next: ProviderId) => {
      if (next === provider) {
        return;
      }
      clearTabs();
      handledConfirmedArtistRef.current = null;
      selectProvider(next);
    },
    [provider, clearTabs, selectProvider]
  );

  const selectedArtist = detailArtist ?? activeTab?.artist ?? null;
  const hasTabs = tabs.length > 0;

  const headerProps = useMemo(
    () => ({
      provider,
      providerOptions: providers,
      providerStatus,
      providerError,
      onProviderChange: handleProviderChange,
      onOpenSettings: openSettings
    }),
    [provider, providers, providerStatus, providerError, handleProviderChange, openSettings]
  );

  const searchProps = useMemo(
    () => ({
      query,
      results,
      status: searchStatus,
      error: searchError,
      selectedId,
      highlightedArtist,
      isPopoverVisible,
      onQueryChange: updateQuery,
      onFocusResults: focusResults,
      onConfirmSelection: confirmSelection,
      onSelectArtist: selectArtist,
      onOpenArtist: openOrFocus
    }),
    [
      query,
      results,
      searchStatus,
      searchError,
      selectedId,
      highlightedArtist,
      isPopoverVisible,
      updateQuery,
      focusResults,
      confirmSelection,
      selectArtist,
      openOrFocus
    ]
  );

  const tabsProps = useMemo(
    () => ({
      items: tabItems,
      activeId: activeTabId,
      onFocus: focusTab,
      onClose: closeTab,
      hasTabs
    }),
    [tabItems, activeTabId, focusTab, closeTab, hasTabs]
  );

  const detailProps = useMemo(
    () => ({
      provider,
      status: detailStatus,
      error: detailError,
      selectedArtist,
      topTracks,
      relatedArtists,
      serviceMetadata,
      onPreviewError: pushToast,
      onOpenRelated: openOrFocus
    }),
    [
      provider,
      detailStatus,
      detailError,
      selectedArtist,
      topTracks,
      relatedArtists,
      serviceMetadata,
      pushToast,
      openOrFocus
    ]
  );

  return (
    <BackgroundSurface mode={backgroundMode}>
      {isIntroOpen ? (
        <div
          className="intro-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('intro.aria')}
          onClick={acknowledgeIntro}
        >
          <div className="intro-overlay__backdrop" />
          <div
            className="intro-overlay__panel"
            role="document"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <p className="label">{t('intro.title')}</p>
            <p className="muted">{t('intro.line1')}</p>
            <p className="muted">{t('intro.line2')}</p>
            <div className="intro-overlay__actions">
              <button type="button" className="intro-overlay__button" onClick={acknowledgeIntro}>
                {t('intro.ok')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div
          className="settings-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('settings.aria')}
          onClick={closeSettings}
        >
          <div className="settings-overlay__backdrop" />
          <div
            className="settings-overlay__panel"
            role="document"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <p className="label">{t('settings.title')}</p>
            <div className="settings-overlay__content">
              <div className="background-toggle">
                <span className="label background-toggle__label">{t('settings.language.label')}</span>
                <label className="background-toggle__switch">
                  <select
                    className="background-toggle__switch-input"
                    value={lang}
                    onChange={(event) => {
                      setLang(event.target.value as Lang);
                    }}
                    aria-label={t('settings.language.label')}
                  >
                    <option value="nl">{t('settings.language.nl')}</option>
                    <option value="en">{t('settings.language.en')}</option>
                  </select>
                </label>
              </div>

              <ThemeToggle value={theme} onChange={setTheme} />
              <BackgroundToggle value={backgroundMode} onChange={setBackgroundMode} />
            </div>
          </div>
        </div>
      ) : null}

      {serverStatus.visible ? (
        <ServerStatusOverlay
          phase={serverStatus.phase}
          progress={serverStatus.progress}
          onRetry={serverStatus.retryNow}
        />
      ) : null}

      <AppRoutes header={headerProps} search={searchProps} tabs={tabsProps} detail={detailProps} toasts={toasts} />

      {hasTabs ? null : null}
    </BackgroundSurface>
  );
}

export default function App(): JSX.Element {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
