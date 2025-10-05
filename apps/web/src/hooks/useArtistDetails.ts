import { useEffect, useRef, useState } from 'react';
import type { Artist, Track } from '@musicdiscovery/shared';
import type { ArtistDetailsPayload } from '../cache/artistCache';
import {
  getCached,
  getCachedStale,
  makeKey,
  setCached,
  withInflight
} from '../cache/artistCache';
import { fetchArtistDetails } from '../api';
import { getSelectedProvider } from '../providerSelection';
import type { AsyncStatus } from './useArtistSearch';

interface UseArtistDetailsOptions {
  topTrackLimit?: number;
  relatedLimit?: number;
}

interface UseArtistDetailsResult {
  status: AsyncStatus;
  error: string | null;
  topTracks: Track[];
  relatedArtists: Artist[];
}

interface InitialState {
  status: AsyncStatus;
  payload: ArtistDetailsPayload | null;
}

function computeInitialState(artistId: string | null, provider: string): InitialState {
  if (!artistId) {
    return { status: 'idle', payload: null };
  }
  const key = makeKey(provider, artistId);
  const fresh = getCached(key);
  if (fresh) {
    return { status: 'success', payload: fresh };
  }
  const stale = getCachedStale(key);
  if (stale) {
    return { status: 'success', payload: stale };
  }
  return { status: 'loading', payload: null };
}

export function useArtistDetails(
  artistId: string | null,
  options: UseArtistDetailsOptions = {}
): UseArtistDetailsResult {
  const { topTrackLimit = 5, relatedLimit = 8 } = options;
  const [provider] = useState(() => getSelectedProvider());
  const initialStateRef = useRef<InitialState | null>(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = computeInitialState(artistId, provider);
  }
  const initialState = initialStateRef.current;

  const [status, setStatus] = useState<AsyncStatus>(initialState.status);
  const [error, setError] = useState<string | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>(initialState.payload?.topTracks ?? []);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>(
    initialState.payload?.relatedArtists ?? []
  );

  useEffect(() => {
    if (!artistId) {
      setStatus('idle');
      setError(null);
      setTopTracks([]);
      setRelatedArtists([]);
      return;
    }

    const key = makeKey(provider, artistId);
    let cancelled = false;

    const applyPayload = (payload: ArtistDetailsPayload) => {
      if (cancelled) return;
      setTopTracks(payload.topTracks);
      setRelatedArtists(payload.relatedArtists);
      setStatus('success');
      setError(null);
    };

    const handleError = (err: unknown, background: boolean) => {
      if (cancelled) return;
      if (background) {
        console.error('Failed to revalidate artist details', err);
        return;
      }
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
      setTopTracks([]);
      setRelatedArtists([]);
    };

    const runFetch = (background: boolean) => {
      void withInflight(key, () =>
        fetchArtistDetails(artistId, provider, { topTrackLimit, relatedLimit })
      )
        .then((payload) => {
          if (cancelled) return;
          setCached(key, payload);
          applyPayload(payload);
        })
        .catch((err) => {
          handleError(err, background);
        });
    };

    const fresh = getCached(key);
    if (fresh) {
      applyPayload(fresh);
      return () => {
        cancelled = true;
      };
    }

    const stale = getCachedStale(key);
    if (stale) {
      applyPayload(stale);
      runFetch(true);
      return () => {
        cancelled = true;
      };
    }

    setStatus('loading');
    setError(null);
    runFetch(false);

    return () => {
      cancelled = true;
    };
  }, [artistId, provider, topTrackLimit, relatedLimit]);

  return { status, error, topTracks, relatedArtists };
}
