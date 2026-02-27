import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ArtistDetails } from '../../domain/repositories/ArtistRepository';
import type { Artist, Track } from '@musicdiscovery/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useArtistDetails } from '../useArtistDetails';

const { getArtistDetailsUseCaseMock } = vi.hoisted(() => ({
  getArtistDetailsUseCaseMock: vi.fn()
}));

vi.mock('../../application/usecases/getArtistDetails', () => ({
  getArtistDetailsUseCase: getArtistDetailsUseCaseMock
}));

function createArtist(id: string): Artist {
  return { id, name: `Artist ${id}` };
}

function createTrack(id: string): Track {
  return {
    id: `track-${id}`,
    name: `Track ${id}`,
    durationMs: 200000,
    previewUrl: undefined,
    artists: [{ id: `artist-${id}`, name: `Artist ${id}` }]
  };
}

function buildDetails(id: string): ArtistDetails {
  return {
    artist: createArtist(id),
    topTracks: [createTrack(`${id}-1`)],
    relatedArtists: [createArtist(`${id}-related`)]
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useArtistDetails', () => {
  beforeEach(() => {
    getArtistDetailsUseCaseMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('returns idle when no artist is selected', () => {
    const { result } = renderHook(() => useArtistDetails(null, 'spotify'), {
      wrapper: createWrapper()
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.artist).toBeNull();
    expect(getArtistDetailsUseCaseMock).not.toHaveBeenCalled();
  });

  test('loads artist details with query use case', async () => {
    const payload = buildDetails('artist-1');
    getArtistDetailsUseCaseMock.mockResolvedValue(payload);

    const { result } = renderHook(() => useArtistDetails('artist-1', 'spotify'), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.artist).toEqual(payload.artist);
    expect(result.current.topTracks).toEqual(payload.topTracks);
    expect(result.current.relatedArtists).toEqual(payload.relatedArtists);
    expect(getArtistDetailsUseCaseMock).toHaveBeenCalledWith('spotify', 'artist-1', {
      topTrackLimit: 5,
      relatedLimit: 8
    });
  });

  test('returns error when use case rejects', async () => {
    getArtistDetailsUseCaseMock.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useArtistDetails('artist-2', 'spotify'), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.artist).toBeNull();
  });
});
