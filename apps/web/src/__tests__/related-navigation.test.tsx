import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Artist, Track } from '@musicdiscovery/shared';
import App from '../App';

const primaryArtist: Artist = {
  id: 'artist-1',
  name: 'Primary Artist',
  imageUrl: 'https://example.com/primary.jpg',
  genres: ['Electronic']
};

const relatedArtist: Artist = {
  id: 'artist-2',
  name: 'Related Star',
  imageUrl: 'https://example.com/related.jpg',
  genres: ['Indie']
};

const stubTrack = (id: string, artist: Artist): Track => ({
  id,
  name: `${artist.name} Track`,
  durationMs: 180000,
  artists: [{ id: artist.id, name: artist.name }]
});

let originalRequestAnimationFrame: typeof window.requestAnimationFrame | undefined;
let originalCancelAnimationFrame: typeof window.cancelAnimationFrame | undefined;

beforeAll(() => {
  originalRequestAnimationFrame = window.requestAnimationFrame;
  originalCancelAnimationFrame = window.cancelAnimationFrame;
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
});

afterAll(() => {
  if (originalRequestAnimationFrame) {
    window.requestAnimationFrame = originalRequestAnimationFrame;
  } else {
    delete (window as typeof window & { requestAnimationFrame?: typeof window.requestAnimationFrame }).requestAnimationFrame;
  }

  if (originalCancelAnimationFrame) {
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  } else {
    delete (window as typeof window & { cancelAnimationFrame?: typeof window.cancelAnimationFrame }).cancelAnimationFrame;
  }
});

vi.mock('../hooks/useArtistSearch', () => ({
  useArtistSearch: () => ({
    query: primaryArtist.name,
    results: [],
    status: 'success' as const,
    error: null,
    selectedId: null,
    highlightedArtist: null,
    confirmedArtist: primaryArtist,
    isPopoverVisible: false,
    updateQuery: vi.fn(),
    focusResults: vi.fn(),
    confirmSelection: vi.fn(),
    selectArtist: vi.fn()
  })
}));

vi.mock('../hooks/useArtistDetails', () => ({
  useArtistDetails: (artistId: string | null) => {
    if (artistId === primaryArtist.id) {
      return {
        status: 'success' as const,
        error: null,
        artist: primaryArtist,
        topTracks: [stubTrack('track-1', primaryArtist)],
        relatedArtists: [relatedArtist]
      };
    }

    if (artistId === relatedArtist.id) {
      return {
        status: 'success' as const,
        error: null,
        artist: relatedArtist,
        topTracks: [stubTrack('track-2', relatedArtist)],
        relatedArtists: []
      };
    }

    return {
      status: 'idle' as const,
      error: null,
      artist: null,
      topTracks: [],
      relatedArtists: []
    };
  }
}));

vi.mock('../api', () => ({
  getProviderCatalog: vi.fn(async () => ({
    items: [
      {
        id: 'tokenless',
        label: 'Tokenless (Deezer + iTunes)',
        description: 'Tokenless provider',
        supportsRelated: true,
        supportsTopTracks: true
      }
    ],
    default: 'tokenless'
  }))
}));

describe('App related artist navigation', () => {
  it('activates the related artist tab when clicked', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /Primary Artist/i });

    const relatedButton = await screen.findByRole('button', { name: /Related Star/i });
    fireEvent.click(relatedButton);

    const relatedHeading = await screen.findByRole('heading', { name: /Related Star/i });
    expect(relatedHeading).toBeVisible();

    const relatedTab = await screen.findByRole('tab', { name: /Related Star/i });
    expect(relatedTab).toHaveAttribute('aria-selected', 'true');
  });
});
