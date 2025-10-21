import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Artist } from '@musicdiscovery/shared';

interface UseTabStateOptions {
  preserveScroll: (callback: () => void) => void;
}

export interface OpenTab {
  id: string;
  name: string;
  imageUrl?: string;
  artist: Artist;
  openedAt: number;
  lastActivatedAt: number;
}

export interface UseTabStateResult {
  tabs: OpenTab[];
  activeTabId: string | null;
  activeTab: OpenTab | null;
  tabItems: Array<{ id: string; name: string; imageUrl?: string }>;
  openOrFocus: (artist: Artist) => void;
  focusTab: (id: string) => void;
  closeTab: (id: string) => void;
  clearTabs: () => void;
  updateTabArtist: (artist: Artist) => void;
}

export function useTabState({ preserveScroll }: UseTabStateOptions): UseTabStateResult {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<OpenTab[]>([]);
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

  const openOrFocus = useCallback(
    (artist: Artist) => {
      preserveScroll(() => {
        const now = Date.now();
        setTabs((current) => {
          const existing = current.find((tab) => tab.id === artist.id);
          if (existing) {
            return current.map((tab) =>
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

          return [...current, nextTab];
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
        setTabs((current) =>
          current.map((tab) => (tab.id === id ? { ...tab, lastActivatedAt: Date.now() } : tab))
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
        setTabs((current) => {
          const remaining = current.filter((tab) => tab.id !== id);
          if (remaining.length === current.length) {
            nextActiveId = activeTabId ?? null;
            return current;
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

  const clearTabs = useCallback(() => {
    preserveScroll(() => {
      setTabs([]);
      setActiveTabId(null);
      lastHistoryArtistIdRef.current = null;
      updateUrlForArtist(null);
    });
  }, [preserveScroll, updateUrlForArtist]);

  const updateTabArtist = useCallback((artist: Artist) => {
    setTabs((current) => {
      let mutated = false;
      const next = current.map((tab) => {
        if (tab.id !== artist.id) {
          return tab;
        }
        if (tab.artist === artist) {
          return tab;
        }
        mutated = true;
        return {
          ...tab,
          name: artist.name,
          imageUrl: artist.imageUrl,
          artist
        };
      });
      return mutated ? next : current;
    });
  }, []);

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

    const matchingTab = tabs.find((tab) => tab.id === currentArtistId);
    if (!matchingTab) {
      return;
    }

    preserveScroll(() => {
      setActiveTabId(currentArtistId);
      setTabs((current) =>
        current.map((tab) =>
          tab.id === currentArtistId ? { ...tab, lastActivatedAt: Date.now() } : tab
        )
      );
    });
  }, [activeTabId, currentArtistId, preserveScroll, tabs]);

  const activeTab = useMemo(
    () => (activeTabId ? tabs.find((tab) => tab.id === activeTabId) ?? null : null),
    [activeTabId, tabs]
  );

  const tabItems = useMemo(
    () => tabs.map(({ id, name, imageUrl }) => ({ id, name, imageUrl })),
    [tabs]
  );

  return {
    tabs,
    activeTabId,
    activeTab,
    tabItems,
    openOrFocus,
    focusTab,
    closeTab,
    clearTabs,
    updateTabArtist
  };
}
