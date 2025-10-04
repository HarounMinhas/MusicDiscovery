import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Artist } from '@musicdiscovery/shared';
import { searchArtists } from '../api';
import { useDebouncedValue } from './useDebouncedValue';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseArtistSearchOptions {
  limit?: number;
  debounceMs?: number;
}

interface UseArtistSearchResult {
  query: string;
  results: Artist[];
  status: AsyncStatus;
  error: string | null;
  selectedId: string | null;
  selectedArtist: Artist | null;
  isPopoverVisible: boolean;
  updateQuery: (value: string) => void;
  focusResults: () => void;
  confirmSelection: () => void;
  selectArtist: (artist: Artist) => void;
}

export function useArtistSearch(options: UseArtistSearchOptions = {}): UseArtistSearchResult {
  const { limit = 10, debounceMs = 350 } = options;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Artist[]>([]);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const manualHideRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const debouncedQuery = useDebouncedValue(query, debounceMs);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed) {
      setStatus('idle');
      setError(null);
      setResults([]);
      setSelectedId(null);
      setIsPopoverOpen(false);
      manualHideRef.current = false;
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    searchArtists(trimmed, limit)
      .then((items) => {
        if (cancelled) return;
        setResults(items);
        setStatus('success');
        if (items.length === 0) {
          setSelectedId(null);
          setIsPopoverOpen(false);
          return;
        }

        if (!manualHideRef.current) {
          setIsPopoverOpen(true);
        }

        if (!items.some((item) => item.id === selectedIdRef.current)) {
          setSelectedId(items[0].id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
        setSelectedId(null);
        setIsPopoverOpen(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, limit]);

  const hasResults = results.length > 0;

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    if (value.trim()) {
      manualHideRef.current = false;
      setIsPopoverOpen(true);
    } else {
      manualHideRef.current = false;
      setIsPopoverOpen(false);
      setSelectedId(null);
    }
  }, []);

  const focusResults = useCallback(() => {
    if (!manualHideRef.current && hasResults) {
      setIsPopoverOpen(true);
    }
  }, [hasResults]);

  const confirmSelection = useCallback(() => {
    manualHideRef.current = true;
    setIsPopoverOpen(false);
    if (!selectedIdRef.current && results[0]) {
      setSelectedId(results[0].id);
    }
  }, [results]);

  const selectArtist = useCallback((artist: Artist) => {
    setSelectedId(artist.id);
    manualHideRef.current = true;
    setIsPopoverOpen(false);
  }, []);

  const selectedArtist = useMemo(
    () => (selectedId ? results.find((item) => item.id === selectedId) ?? null : null),
    [results, selectedId]
  );

  return {
    query,
    results,
    status,
    error,
    selectedId,
    selectedArtist,
    isPopoverVisible: isPopoverOpen && hasResults,
    updateQuery,
    focusResults,
    confirmSelection,
    selectArtist
  };
}
