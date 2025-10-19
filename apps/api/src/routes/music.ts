import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { Readable } from 'node:stream';
import { env } from '../env.js';
import { withCache } from '../cache.js';
import { getSmartRelated } from '../controllers/deezerSmartController.js';
import {
  ArtistSchema,
  RelatedArtistsResponseSchema,
  SearchArtistsResponseSchema,
  TopTracksResponseSchema,
  TrackSchema,
  type Track
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

function resolveBaseUrl(req: Request) {
  const host = req.get('host');
  if (!host) {
    return null;
  }
  const forwarded = req.headers['x-forwarded-proto'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const proto = forwardedValue?.split(',')[0]?.trim() || req.protocol;
  return `${proto}://${host}`;
}

function attachPreviewProxy(track: Track | null, req: Request): Track | null {
  if (!track || !track.previewUrl) {
    return track;
  }
  const origin = resolveBaseUrl(req);
  if (!origin) {
    return track;
  }
  return {
    ...track,
    previewProxyUrl: `${origin}/api/music/tracks/${encodeURIComponent(track.id)}/preview`
  };
}

async function proxyTrackPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const { mode, provider } = resolveProvider(req);
    const track = await withCache(
      `track:${mode}:${req.params.id}`,
      1000 * 60 * 5,
      () => provider.getTrack(req.params.id)
    );
    if (!track || !track.previewUrl) {
      res.status(404).json({ error: { code: 'not_found', message: 'Preview not available' } });
      return;
    }

    const controller = new AbortController();
    const headers: Record<string, string> = {};
    if (typeof req.headers.range === 'string') {
      headers.Range = req.headers.range;
    }

    const upstream = await fetch(track.previewUrl, {
      headers,
      redirect: 'follow',
      signal: controller.signal
    });

    res.status(upstream.status);
    const forwardHeaders = ['content-type', 'content-length', 'accept-ranges', 'content-range', 'etag'];
    for (const header of forwardHeaders) {
      const value = upstream.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Expose-Headers', 'accept-ranges,content-length,content-range');

    req.on('close', () => {
      controller.abort();
    });

    if (req.method === 'HEAD' || !upstream.body) {
      res.end();
      controller.abort();
      return;
    }

    const nodeStream = Readable.fromWeb(upstream.body as unknown as ReadableStream<Uint8Array>);
    nodeStream.on('error', (error) => {
      controller.abort();
      if (!res.headersSent) {
        next(error);
      } else {
        res.destroy(error as Error);
      }
    });
    nodeStream.pipe(res);
  } catch (error) {
    console.error('Failed to proxy preview', error);
    if (!res.headersSent) {
      res.status(502).json({ error: { code: 'preview_proxy_failed', message: 'Failed to load preview audio' } });
    } else {
      res.end();
    }
  }
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
    const decorated = items.map((track) => attachPreviewProxy(track, req) ?? track);
    const parsed = TopTracksResponseSchema.parse({ items: decorated });
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
    const decorated = attachPreviewProxy(track, req) ?? track;
    res.json(TrackSchema.parse(decorated));
  } catch (error) {
    next(error);
  }
});

router.get('/music/tracks/:id/preview', proxyTrackPreview);
router.head('/music/tracks/:id/preview', proxyTrackPreview);

router.get('/deezer/related-smart', (req, res) => {
  void getSmartRelated(req, res);
});

export default router;
