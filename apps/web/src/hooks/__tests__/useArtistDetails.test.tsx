import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ArtistDetailsPayload } from '../../cache/artistCache';
import { clearAll as clearArtistCache, makeKey, setCached } from '../../cache/artistCache';
import type { Artist, Track } from '@musicdiscovery/shared';
import { useArtistDetails } from '../useArtistDetails';

const { fetchArtistDetailsMock } = vi.hoisted(() => ({
  fetchArtistDetailsMock: vi.fn()
}));

vi.mock('../../api', () => ({
  fetchArtistDetails: fetchArtistDetailsMock
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

function buildPayload(id: string, provider = 'spotify'): ArtistDetailsPayload {
  return {
    artist: createArtist(id),
    topTracks: [createTrack(`${id}-1`)],
    relatedArtists: [createArtist(`${id}-related`)],
    provider,
    fetchedAt: Date.now()
  };
}

describe('useArtistDetails', () => {
  beforeEach(() => {
    clearArtistCache();
    window.localStorage.clear();
    fetchArtistDetailsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  test('returns cached data immediately when fresh', () => {
    const key = makeKey('spotify', 'artist-1');
    const cached = buildPayload('artist-1');
    setCached(key, cached);

    const { result } = renderHook(() => useArtistDetails('artist-1', 'spotify'));

    expect(result.current.status).toBe('success');
    expect(result.current.artist).toEqual(cached.artist);
    expect(result.current.topTracks).toEqual(cached.topTracks);
    expect(result.current.relatedArtists).toEqual(cached.relatedArtists);
    expect(fetchArtistDetailsMock).not.toHaveBeenCalled();
  });

  test('does not trigger duplicate fetches while in flight', async () => {
    let resolveFetch: ((value: ArtistDetailsPayload) => void) | undefined;
    const payload = buildPayload('artist-2');
    fetchArtistDetailsMock.mockImplementation(
      () =>
        new Promise<ArtistDetailsPayload>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { result, rerender } = renderHook(
      ({ id, provider }: { id: string; provider: string }) => useArtistDetails(id, provider),
      {
        initialProps: { id: 'artist-2', provider: 'spotify' }
      }
    );

    await waitFor(() => expect(fetchArtistDetailsMock).toHaveBeenCalledTimes(1));
    rerender({ id: 'artist-2', provider: 'spotify' });

    expect(fetchArtistDetailsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch?.(payload);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.artist).toEqual(payload.artist);
    expect(result.current.topTracks).toEqual(payload.topTracks);
  });

  test('serves stale data and revalidates in background', async () => {
    const key = makeKey('spotify', 'artist-3');
    const stale = buildPayload('artist-3');
    setCached(key, stale, 1);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const fresh = buildPayload('artist-3');
    fresh.topTracks = [createTrack('artist-3-new')];
    fetchArtistDetailsMock.mockResolvedValue(fresh);

    const { result } = renderHook(() => useArtistDetails('artist-3', 'spotify'));

    expect(result.current.status).toBe('success');
    expect(result.current.artist).toEqual(stale.artist);
    expect(result.current.topTracks).toEqual(stale.topTracks);

    await waitFor(() => {
      expect(fetchArtistDetailsMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.artist).toEqual(fresh.artist);
      expect(result.current.topTracks).toEqual(fresh.topTracks);
    });

    expect(fetchArtistDetailsMock).toHaveBeenCalledTimes(1);
  });
});
