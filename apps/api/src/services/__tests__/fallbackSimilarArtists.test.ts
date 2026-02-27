import { describe, it, expect, vi, beforeEach } from 'vitest';

const lastFmMock = vi.fn();
const musicBrainzMock = vi.fn();
const discogsMock = vi.fn();

vi.mock('../fallbackSimilarArtists/lastfm.js', () => ({
  getSimilarArtistsFromLastFm: lastFmMock
}));

vi.mock('../fallbackSimilarArtists/musicbrainz.js', () => ({
  getSimilarArtistsFromMusicBrainz: musicBrainzMock
}));

vi.mock('../fallbackSimilarArtists/discogs.js', () => ({
  getSimilarArtistsFromDiscogs: discogsMock
}));

describe('getDeterministicFallbackSimilarArtists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines and deduplicates results from all fallback providers', async () => {
    const { getDeterministicFallbackSimilarArtists } = await import('../fallbackSimilarArtists/index.js');

    lastFmMock.mockResolvedValue([
      {
        name: 'Massive Attack',
        normalizedName: 'massiveattack',
        similarityScore: 0.9,
        confidenceScore: 0.9,
        uxLabel: 'audio-similarity-based',
        source: 'lastfm'
      }
    ]);

    musicBrainzMock.mockResolvedValue([
      {
        name: 'Massive Attack',
        normalizedName: 'massiveattack',
        similarityScore: 0.5,
        confidenceScore: 0.4,
        uxLabel: 'metadata-based',
        source: 'musicbrainz'
      },
      {
        name: 'Portishead',
        normalizedName: 'portishead',
        similarityScore: 0.6,
        confidenceScore: 0.6,
        uxLabel: 'metadata-based',
        source: 'musicbrainz'
      }
    ]);

    discogsMock.mockResolvedValue([
      {
        name: 'Tricky',
        normalizedName: 'tricky',
        similarityScore: 0.7,
        confidenceScore: 0.6,
        uxLabel: 'scene-based',
        source: 'discogs'
      }
    ]);

    const result = await getDeterministicFallbackSimilarArtists({
      query: 'Björk',
      limit: 5,
      log: {
        info: vi.fn(),
        warn: vi.fn()
      } as any
    });

    expect(result.strategy).toBe('deterministic-fallback');
    expect(result.items.map((item) => item.normalizedName)).toEqual([
      'massiveattack',
      'tricky',
      'portishead'
    ]);
    expect(result.items[0]?.source).toBe('lastfm');
  });
});
