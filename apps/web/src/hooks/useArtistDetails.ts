import { useEffect, useState } from 'react';
import type { Artist, Track } from '@musicdiscovery/shared';
import { getRelatedArtists, getTopTracks } from '../api';
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

export function useArtistDetails(
  artistId: string | null,
  options: UseArtistDetailsOptions = {}
): UseArtistDetailsResult {
  const { topTrackLimit = 5, relatedLimit = 8 } = options;
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>([]);

  useEffect(() => {
    if (!artistId) {
      setStatus('idle');
      setError(null);
      setTopTracks([]);
      setRelatedArtists([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    Promise.all([
      getTopTracks(artistId, undefined, topTrackLimit),
      getRelatedArtists(artistId, relatedLimit)
    ])
      .then(([tracks, related]) => {
        if (cancelled) return;
        setTopTracks(tracks);
        setRelatedArtists(related);
        setStatus('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
        setTopTracks([]);
        setRelatedArtists([]);
      });

    return () => {
      cancelled = true;
    };
  }, [artistId, topTrackLimit, relatedLimit]);

  return { status, error, topTracks, relatedArtists };
}
