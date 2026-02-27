import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { DeezerArtist } from '../types.js';

vi.mock('../deezerService.js', async () => {
  const actual = await vi.importActual<typeof import('../deezerService.js')>('../deezerService.js');
  return {
    ...actual,
    searchArtistByName: vi.fn(),
    getRelatedArtists: vi.fn()
  } satisfies Partial<typeof actual>;
});

vi.mock('../musicbrainzService.js', async () => {
  const actual = await vi.importActual<typeof import('../musicbrainzService.js')>('../musicbrainzService.js');
  return {
    ...actual,
    searchGroupByName: vi.fn(),
    getGroupWithMemberRels: vi.fn()
  } satisfies Partial<typeof actual>;
});

import { relatedByBandOrMembers } from '../smartRelatedService.js';
import { SmartRelatedError } from '../errors.js';
import { getSmartRelatedConfig, overrideSmartRelatedConfig } from '../smartRelatedConfig.js';
import {
  searchArtistByName,
  getRelatedArtists
} from '../deezerService.js';
import { searchGroupByName, getGroupWithMemberRels } from '../musicbrainzService.js';

const searchArtistByNameMock = vi.mocked(searchArtistByName);
const getRelatedArtistsMock = vi.mocked(getRelatedArtists);
const searchGroupByNameMock = vi.mocked(searchGroupByName);
const getGroupWithMemberRelsMock = vi.mocked(getGroupWithMemberRels);

const relatedArtist = (id: number, name: string, nbFan = 0): DeezerArtist => ({
  id,
  name,
  nb_fan: nbFan
});

const baseConfig = { ...getSmartRelatedConfig() };

describe('relatedByBandOrMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    overrideSmartRelatedConfig({ enabled: true, cacheTtlMs: 1000, maxMembers: 8, defaultUseFallback: true });
  });

  afterEach(() => {
    overrideSmartRelatedConfig(baseConfig);
  });

  it('returns Deezer related artists when a direct match exists', async () => {
  searchArtistByNameMock.mockResolvedValueOnce({
    artists: [{ id: 42, name: 'Radiohead', nb_fan: 1000 }],
    cacheHit: false
  });
  getRelatedArtistsMock.mockResolvedValueOnce({
    artists: [relatedArtist(1, 'Thom Yorke'), relatedArtist(2, 'Atoms for Peace')],
    cacheHit: false
  });

  const result = await relatedByBandOrMembers('Radiohead', 5, { allowFallback: true });

  expect(result.strategy).toBe('deezer-related');
  expect(result.items.map((item) => item.name)).toEqual(['Thom Yorke', 'Atoms for Peace']);
  expect(result.seeds).toEqual(['Radiohead']);
  expect(result.cacheHit).toBe(false);
  });

  it('falls back to member aggregation when Deezer returns no related artists', async () => {
    searchArtistByNameMock.mockImplementation(async (name) => {
      if (name === 'The Beta Band') {
        return { artists: [{ id: 99, name, nb_fan: 200 }], cacheHit: false };
      }
      return { artists: [{ id: name.length, name, nb_fan: 100 }], cacheHit: false };
    });

    getRelatedArtistsMock.mockImplementation(async (id) => {
      if (id === 99) {
        return { artists: [], cacheHit: false };
      }
      return { artists: [relatedArtist(id * 10, `Related ${id}`)], cacheHit: false };
    });

    searchGroupByNameMock.mockResolvedValueOnce({
      artist: { id: 'mbid-beta', name: 'The Beta Band', type: 'Group', score: 85 },
      cacheHit: false
    });

    getGroupWithMemberRelsMock.mockResolvedValueOnce({
      group: {
        id: 'mbid-beta',
        name: 'The Beta Band',
        relations: [
          { type: 'member of band', artist: { id: 'm1', name: 'Steve Mason' } },
          { type: 'member of band', artist: { id: 'm2', name: 'John Maclean' } }
        ]
      },
      cacheHit: false
    });

    const result = await relatedByBandOrMembers('The Beta Band', 5, { allowFallback: true });

    expect(result.strategy).toBe('fallback-members-aggregation');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.seeds).toEqual(['Steve Mason', 'John Maclean']);
  });

  it('falls back to member aggregation when Deezer has no direct match', async () => {
  searchArtistByNameMock.mockImplementation(async (name) => {
    if (name === 'Blur') {
      return { artists: [], cacheHit: false };
    }
    return {
      artists: [{ id: name.length, name, nb_fan: 10 }],
      cacheHit: false
    };
  });

  getRelatedArtistsMock.mockImplementation(async (id) => {
    return {
      artists: [relatedArtist(id * 10, `Related ${id}`)],
      cacheHit: false
    };
  });

  searchGroupByNameMock.mockResolvedValueOnce({
    artist: { id: 'mbid-1', name: 'Blur', type: 'Group', score: 80 },
    cacheHit: false
  });

  getGroupWithMemberRelsMock.mockResolvedValueOnce({
    group: {
      id: 'mbid-1',
      name: 'Blur',
      relations: [
        { type: 'member of band', artist: { id: 'm1', name: 'Damon Albarn' } },
        { type: 'member of band', artist: { id: 'm2', name: 'Graham Coxon' } }
      ]
    },
    cacheHit: false
  });

  const result = await relatedByBandOrMembers('Blur', 5, { allowFallback: true });

  expect(result.strategy).toBe('fallback-members-aggregation');
  expect(result.items.length).toBeGreaterThan(0);
  const firstItem = result.items[0];
  expect(firstItem?.name).toMatch(/Related/);
  expect(result.seeds).toEqual(['Damon Albarn', 'Graham Coxon']);
  });

  it('ranks aggregated artists by frequency and popularity', async () => {
  searchArtistByNameMock.mockImplementation(async (name) => {
    if (name === 'Muse') return { artists: [], cacheHit: false };
    return { artists: [{ id: name.length, name, nb_fan: name === 'Matt Bellamy' ? 500 : 200 }], cacheHit: false };
  });

  getRelatedArtistsMock.mockImplementation(async (id) => {
    if (id === 'Matt Bellamy'.length) {
      return {
        artists: [relatedArtist(1, 'Queen', 2_000_000), relatedArtist(2, 'Foo Fighters', 1_500_000)],
        cacheHit: false
      };
    }
    return {
      artists: [relatedArtist(1, 'Queen', 2_000_000), relatedArtist(3, 'Coldplay', 1_000_000)],
      cacheHit: false
    };
  });

  searchGroupByNameMock.mockResolvedValueOnce({
    artist: { id: 'mbid-muse', name: 'Muse', type: 'Group', score: 90 },
    cacheHit: false
  });

  getGroupWithMemberRelsMock.mockResolvedValueOnce({
    group: {
      id: 'mbid-muse',
      name: 'Muse',
      relations: [
        { type: 'member of band', artist: { id: 'm1', name: 'Matt Bellamy' } },
        { type: 'member of band', artist: { id: 'm2', name: 'Dominic Howard' } }
      ]
    },
    cacheHit: false
  });

  const result = await relatedByBandOrMembers('Muse', 5, { allowFallback: true });

  expect(result.strategy).toBe('fallback-members-aggregation');
  const firstItem = result.items[0];
  expect(firstItem?.name).toBe('Queen');
  expect(result.items.map((item) => item.name)).toContain('Foo Fighters');
  expect(result.items.map((item) => item.name)).toContain('Coldplay');
  expect(result.seeds).toEqual(['Matt Bellamy', 'Dominic Howard']);
  });

  it('throws NOT_FOUND when fallback is disabled and no Deezer match exists', async () => {
  searchArtistByNameMock.mockResolvedValueOnce({ artists: [], cacheHit: false });

  await expect(relatedByBandOrMembers('Unknown Band', 5, { allowFallback: false })).rejects.toMatchObject({
    code: 'NOT_FOUND'
  });
  });

  it('continues when individual member lookups fail', async () => {
  searchArtistByNameMock.mockImplementation(async (name) => {
    if (name === 'Slowdive') return { artists: [], cacheHit: false };
    return { artists: [{ id: name.length, name, nb_fan: 100 }], cacheHit: false };
  });

  let call = 0;
  getRelatedArtistsMock.mockImplementation(async (id) => {
    call++;
    if (call === 1) {
      throw new SmartRelatedError('TIMEOUT', 'timeout');
    }
    return { artists: [relatedArtist(id * 10, 'Result')], cacheHit: false };
  });

  searchGroupByNameMock.mockResolvedValueOnce({
    artist: { id: 'mbid-slowdive', name: 'Slowdive', type: 'Group', score: 75 },
    cacheHit: false
  });

  getGroupWithMemberRelsMock.mockResolvedValueOnce({
    group: {
      id: 'mbid-slowdive',
      name: 'Slowdive',
      relations: [
        { type: 'member of band', artist: { id: 'm1', name: 'Neil Halstead' } },
        { type: 'member of band', artist: { id: 'm2', name: 'Rachel Goswell' } }
      ]
    },
    cacheHit: false
  });

  const result = await relatedByBandOrMembers('Slowdive', 5, { allowFallback: true });

  expect(result.items.length).toBe(1);
  const firstItem = result.items[0];
  expect(firstItem?.name).toBe('Result');
  expect(result.seeds).toEqual(['Neil Halstead', 'Rachel Goswell']);
  });

  it('respects the configured max member limit', async () => {
  overrideSmartRelatedConfig({ maxMembers: 1 });

  searchArtistByNameMock.mockImplementation(async (name) => {
    if (name === 'Paramore') return { artists: [], cacheHit: false };
    return { artists: [{ id: name.length, name, nb_fan: 100 }], cacheHit: false };
  });

  getRelatedArtistsMock.mockImplementation(async (id) => {
    return { artists: [relatedArtist(id * 5, `Candidate ${id}`)], cacheHit: false };
  });

  searchGroupByNameMock.mockResolvedValueOnce({
    artist: { id: 'mbid-paramore', name: 'Paramore', type: 'Group', score: 90 },
    cacheHit: false
  });

  getGroupWithMemberRelsMock.mockResolvedValueOnce({
    group: {
      id: 'mbid-paramore',
      name: 'Paramore',
      relations: [
        { type: 'member of band', artist: { id: 'm1', name: 'Hayley Williams' } },
        { type: 'member of band', artist: { id: 'm2', name: 'Taylor York' } }
      ]
    },
    cacheHit: false
  });

  const result = await relatedByBandOrMembers('Paramore', 5, { allowFallback: true });

  expect(result.items.map((item) => item.name)).toEqual(['Candidate 15']);
  expect(result.seeds).toEqual(['Hayley Williams']);
  });
});
