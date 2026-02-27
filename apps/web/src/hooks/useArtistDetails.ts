import { useEffect, useMemo, useState } from 'react';
import type { Artist, ProviderId, Track, ServiceMetadata } from '@musicdiscovery/shared';
import type { ArtistDetailsPayload } from '../cache/artistCache';
import {
  getCached,
  getCachedStale,
  makeKey,
  setCached,
  withInflight
} from '../cache/artistCache';
import { fetchArtistDetails } from '../api';
import type { AsyncStatus } from './useArtistSearch';

interface UseArtistDetailsOptions {
  topTrackLimit?: number;
  relatedLimit?: number;
}

interface UseArtistDetailsResult {
  status: AsyncStatus;
  error: string | null;
  artist: Artist | null;
  topTracks: Track[];
  relatedArtists: Artist[];
  serviceMetadata?: ServiceMetadata;
}

interface InitialState {
  status: AsyncStatus;
  payload: ArtistDetailsPayload | null;
}

function computeInitialState(artistId: string | null, provider: ProviderId): InitialState {
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
  provider: ProviderId,
  options: UseArtistDetailsOptions = {}
): UseArtistDetailsResult {
  const { topTrackLimit = 5, relatedLimit = 8 } = options;
  const initialState = useMemo(() => computeInitialState(artistId, provider), [artistId, provider]);

  const [status, setStatus] = useState<AsyncStatus>(initialState.status);
  const [error, setError] = useState<string | null>(null);
  const [artist, setArtist] = useState<Artist | null>(initialState.payload?.artist ?? null);
  const [topTracks, setTopTracks] = useState<Track[]>(initialState.payload?.topTracks ?? []);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>(
    initialState.payload?.relatedArtists ?? []
  );
  const [serviceMetadata, setServiceMetadata] = useState<ServiceMetadata | undefined>(
    initialState.payload?.serviceMetadata
  );

  useEffect(() => {
    setStatus(initialState.status);
    setError(null);
    setArtist(initialState.payload?.artist ?? null);
    setTopTracks(initialState.payload?.topTracks ?? []);
    setRelatedArtists(initialState.payload?.relatedArtists ?? []);
    setServiceMetadata(initialState.payload?.serviceMetadata);
  }, [initialState]);

  useEffect(() => {
    if (!artistId) {
      setStatus('idle');
      setError(null);
      setArtist(null);
      setTopTracks([]);
      setRelatedArtists([]);
      setServiceMetadata(undefined);
      return;
    }

    const key = makeKey(provider, artistId);
    let cancelled = false;

    const applyPayload = (payload: ArtistDetailsPayload) => {
      if (cancelled) return;
      setArtist(payload.artist);
      setTopTracks(payload.topTracks);
      setRelatedArtists(payload.relatedArtists);
      setServiceMetadata(payload.serviceMetadata);
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
      setArtist(null);
      setTopTracks([]);
      setRelatedArtists([]);
      setServiceMetadata(undefined);
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
    setArtist(null);
    runFetch(false);

    return () => {
      cancelled = true;
    };
  }, [artistId, provider, topTrackLimit, relatedLimit]);

  return { status, error, artist, topTracks, relatedArtists, serviceMetadata };
}
