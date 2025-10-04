import { Router } from 'express';
import { env } from '../env.js';
import { withCache } from '../cache.js';
import {
  ArtistSchema,
  RelatedArtistsResponseSchema,
  SearchArtistsResponseSchema,
  TopTracksResponseSchema,
  TrackSchema
} from '@musicdiscovery/shared';
import { getDefaultProviderMode, getProviderMetadata, resolveProvider } from '../providerRegistry.js';

const router = Router();

function parseLimit(value: unknown, fallback = 10, max = 25) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(Math.floor(numeric), max);
  }
  return fallback;
}

router.get('/providers', (_req, res) => {
  res.json({
    default: getDefaultProviderMode(),
    items: getProviderMetadata()
  });
});

router.get('/music/search', async (req, res, next) => {
  try {
    const query = String(req.query.query ?? '').trim();
    const limit = parseLimit(req.query.limit);
    if (!query) {
      res.json(SearchArtistsResponseSchema.parse({ items: [] }));
      return;
    }
    const { mode, provider } = resolveProvider(req);
    const items = await withCache(
      `search:${mode}:${query}:${limit}`,
      1000 * 60 * 60 * 2,
      () => provider.searchArtists(query, limit)
    );
    const parsed = SearchArtistsResponseSchema.parse({ items });
    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

router.get('/music/artists/:id', async (req, res, next) => {
  try {
    const { mode, provider } = resolveProvider(req);
    const artist = await withCache(
      `artist:${mode}:${req.params.id}`,
      1000 * 60 * 60 * 24,
      () => provider.getArtist(req.params.id)
    );
    if (!artist) {
      res.status(404).json({ error: { code: 'not_found', message: 'Artist not found' } });
      return;
    }
    res.json(ArtistSchema.parse(artist));
  } catch (error) {
    next(error);
  }
});

router.get('/music/artists/:id/related', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const { mode, provider } = resolveProvider(req);
    const items = await withCache(
      `artist:${mode}:${req.params.id}:related:${limit}`,
      1000 * 60 * 60 * 24,
      () => provider.getRelatedArtists(req.params.id, limit)
    );
    const parsed = RelatedArtistsResponseSchema.parse({ items });
    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

router.get('/music/artists/:id/top-tracks', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const market = String(req.query.market ?? env.MARKET).trim() || env.MARKET;
    const { mode, provider } = resolveProvider(req);
    const items = await withCache(
      `artist:${mode}:${req.params.id}:top:${market}:${limit}`,
      1000 * 60 * 5,
      () => provider.getTopTracks(req.params.id, market, limit)
    );
    const parsed = TopTracksResponseSchema.parse({ items });
    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

router.get('/music/tracks/:id', async (req, res, next) => {
  try {
    const { mode, provider } = resolveProvider(req);
    const track = await withCache(
      `track:${mode}:${req.params.id}`,
      1000 * 60 * 5,
      () => provider.getTrack(req.params.id)
    );
    if (!track) {
      res.status(404).json({ error: { code: 'not_found', message: 'Track not found' } });
      return;
    }
    res.json(TrackSchema.parse(track));
  } catch (error) {
    next(error);
  }
});

export default router;
