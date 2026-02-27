import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { once } from 'node:events';
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
  type Track,
  type ServiceMetadata
} from '@musicdiscovery/shared';
import { getDefaultProviderMode, getProviderMetadata, resolveProvider } from '../providerRegistry.js';
import type { Logger } from 'pino';
import { logger } from '../logger.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { getDeterministicFallbackSimilarArtists } from '../services/fallbackSimilarArtists/index.js';
import { normalizeArtistName } from '../services/fallbackSimilarArtists/normalize.js';

const router = Router();

const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

interface RequestWithLogger extends Request {
  log: Logger;
}

function getRequestLogger(req: Request, bindings?: Record<string, unknown>) {
  const base = (req as RequestWithLogger).log ?? logger;
  return bindings ? base.child(bindings) : base;
}

function parseLimit(value: unknown, fallback = 10, max = 25) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(Math.floor(numeric), max);
  }
  return fallback;
}

function attachPreviewProxy(track: Track): Track {
  if (!track.previewUrl) {
    return track;
  }
  return {
    ...track,
    previewProxyUrl: `/api/music/tracks/${encodeURIComponent(track.id)}/preview`
  };
}

async function proxyTrackPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const { mode, provider } = resolveProvider(req);
    const log = getRequestLogger(req, { route: 'preview', providerMode: mode, trackId: req.params.id });
    const trackId = req.params.id;
    if (!trackId) {
      res.status(400).json({ error: { code: 'bad_request', message: 'Track ID is required' } });
      return;
    }
    const track = await withCache(
      `track:${mode}:${trackId}`,
      1000 * 60 * 5,
      () => provider.getTrack(trackId)
    );
    if (!track || !track.previewUrl) {
      log.warn('Preview not available for requested track');
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

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('audio/')) {
      controller.abort();
      log.warn({ contentType }, 'Rejected preview due to unsupported content type');
      res.type('application/json')
        .status(415)
        .json({ error: { code: 'preview_unsupported', message: 'Voorbeeld is geen audio-bestand' } });
      return;
    }

    const contentLengthHeader = upstream.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_PREVIEW_BYTES) {
        controller.abort();
        log.warn({ contentLength }, 'Rejected preview that exceeds maximum size');
        res.removeHeader('Content-Length');
        res.type('application/json')
          .status(413)
          .json({ error: { code: 'preview_too_large', message: 'Preview-audio is groter dan 10 MB' } });
        return;
      }
    }

    res.setHeader('Content-Type', contentType);
    if (contentLengthHeader) {
      res.setHeader('Content-Length', contentLengthHeader);
    }
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }
    const etag = upstream.headers.get('etag');
    if (etag) {
      res.setHeader('ETag', etag);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Expose-Headers', 'accept-ranges,content-length,content-range');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.status(upstream.status);

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

    let transferred = 0;
    for await (const chunk of nodeStream) {
      if (transferred + chunk.length > MAX_PREVIEW_BYTES) {
        controller.abort();
        nodeStream.destroy();
        log.warn({ transferred, chunkSize: chunk.length }, 'Aborted preview stream after exceeding size limit');
        if (!res.headersSent) {
          res.removeHeader('Content-Length');
          res.type('application/json')
            .status(413)
            .json({ error: { code: 'preview_too_large', message: 'Preview-audio is groter dan 10 MB' } });
        } else {
          res.destroy();
        }
        return;
      }
      transferred += chunk.length;
      if (!res.write(chunk)) {
        await once(res, 'drain');
      }
    }
    res.end();
  } catch (error) {
    const log = getRequestLogger(req, { route: 'preview', trackId: req.params.id });
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to proxy preview');
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
      () => provider.getArtist(req.params.id!)
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

    // Track service metadata for status labels
    const serviceMetadata: ServiceMetadata = {
      deezer: 'unused',
      lastfm: 'unused',
      musicbrainz: 'unused',
      discogs: 'unused'
    };

    const items = await withCache(
      `artist:${mode}:${req.params.id}:related:${limit}`,
      1000 * 60 * 60 * 24,
      () => provider.getRelatedArtists(req.params.id!, limit)
    );

    if (items.length > 0) {
      // Deezer primary API returned results
      serviceMetadata.deezer = 'success';
      const labeled = items.map((item) => ({ ...item, uxLabel: 'audio-similarity-based', uxSource: 'deezer' }));
      const parsed = RelatedArtistsResponseSchema.parse({ 
        items: labeled, 
        serviceMetadata 
      });
      res.json(parsed);
      return;
    }

    // Deezer returned nothing - mark as empty and try fallback
    serviceMetadata.deezer = 'empty';

    const log = getRequestLogger(req, { route: 'related', providerMode: mode, artistId: req.params.id });

    const artist = await withCache(
      `artist:${mode}:${req.params.id}`,
      1000 * 60 * 60 * 24,
      () => provider.getArtist(req.params.id!)
    );

    const queryName = String(artist?.name ?? '').trim();
    if (!queryName) {
      const parsed = RelatedArtistsResponseSchema.parse({ 
        items: [], 
        serviceMetadata 
      });
      res.json(parsed);
      return;
    }

    const fallback = await getDeterministicFallbackSimilarArtists({ log, query: queryName, limit });
    
    // Update service metadata based on fallback results
    if (fallback.items.length > 0) {
      // Determine which services returned results based on uxLabel
      const sources = new Set(fallback.items.map(item => item.source));
      
      if (sources.has('lastfm')) serviceMetadata.lastfm = 'success';
      else if (env.LASTFM_API_KEY) serviceMetadata.lastfm = 'empty';
      
      if (sources.has('musicbrainz')) serviceMetadata.musicbrainz = 'success';
      else serviceMetadata.musicbrainz = 'empty';
      
      if (sources.has('discogs')) serviceMetadata.discogs = 'success';
      else if (env.DISCOGS_TOKEN) serviceMetadata.discogs = 'empty';
    } else {
      // All fallback services returned empty
      if (env.LASTFM_API_KEY) serviceMetadata.lastfm = 'empty';
      serviceMetadata.musicbrainz = 'empty';
      if (env.DISCOGS_TOKEN) serviceMetadata.discogs = 'empty';
    }

    if (fallback.items.length === 0) {
      const parsed = RelatedArtistsResponseSchema.parse({ 
        items: [], 
        serviceMetadata 
      });
      res.json(parsed);
      return;
    }

    const resolved: { id: string; name: string; imageUrl?: string; genres?: string[]; popularity?: number; uxLabel?: string; uxSource?: string }[] = [];
    const seenIds = new Set<string>();

    await mapWithConcurrency(
      fallback.items,
      async (candidate) => {
        try {
          const searchResults = await provider.searchArtists(candidate.name, 5);
          if (!searchResults.length) return;

          const candidateKey = candidate.normalizedName;
          const exact = searchResults.find((result) => normalizeArtistName(result.name) === candidateKey);
          const best = exact ?? searchResults[0]!;

          if (seenIds.has(best.id)) return;
          seenIds.add(best.id);
          resolved.push({ ...best, uxLabel: candidate.uxLabel, uxSource: candidate.source });
        } catch (error) {
          log.warn({ err: error, candidate: candidate.name }, 'Failed to resolve fallback artist name (swallowed)');
        }
      },
      3
    );

    const finalItems = resolved.slice(0, limit);
    const parsed = RelatedArtistsResponseSchema.parse({ 
      items: finalItems, 
      serviceMetadata 
    });
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
      () => provider.getTopTracks(req.params.id!, market, limit)
    );
    const decorated = items.map((track) => attachPreviewProxy(track));
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
      () => provider.getTrack(req.params.id!)
    );
    if (!track) {
      res.status(404).json({ error: { code: 'not_found', message: 'Track not found' } });
      return;
    }
    const decorated = attachPreviewProxy(track);
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
