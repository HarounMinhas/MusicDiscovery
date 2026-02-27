import type { Artist, ProviderId, ServiceMetadata, Track } from '@musicdiscovery/shared';
import { useQuery } from '@tanstack/react-query';
import { getArtistDetailsUseCase } from '../application/usecases/getArtistDetails';
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

export function useArtistDetails(
  artistId: string | null,
  provider: ProviderId,
  options: UseArtistDetailsOptions = {}
): UseArtistDetailsResult {
  const { topTrackLimit = 5, relatedLimit = 8 } = options;

  const detailsQuery = useQuery({
    queryKey: ['artist-details', provider, artistId, topTrackLimit, relatedLimit],
    queryFn: () =>
      getArtistDetailsUseCase(provider, artistId as string, {
        topTrackLimit,
        relatedLimit
      }),
    enabled: Boolean(artistId),
    staleTime: 60_000
  });

  const status: AsyncStatus = !artistId
    ? 'idle'
    : detailsQuery.isPending
      ? 'loading'
      : detailsQuery.isError
        ? 'error'
        : 'success';

  return {
    status,
    error: detailsQuery.isError
      ? detailsQuery.error instanceof Error
        ? detailsQuery.error.message
        : String(detailsQuery.error)
      : null,
    artist: detailsQuery.data?.artist ?? null,
    topTracks: detailsQuery.data?.topTracks ?? [],
    relatedArtists: detailsQuery.data?.relatedArtists ?? [],
    serviceMetadata: detailsQuery.data?.serviceMetadata
  };
}
