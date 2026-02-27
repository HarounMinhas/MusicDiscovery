import type { Request, Response } from 'express';
import type { Logger } from 'pino';
import { SmartRelatedResponseSchema } from '@musicdiscovery/shared';
import { relatedByBandOrMembers } from '../services/smartRelatedService.js';
import { getSmartRelatedConfig } from '../services/smartRelatedConfig.js';
import { SmartRelatedError } from '../services/errors.js';
import { logger } from '../logger.js';
import { getDeterministicFallbackSimilarArtists } from '../services/fallbackSimilarArtists/index.js';

function parseLimit(value: unknown, fallback = 10, max = 20) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(Math.floor(numeric), max);
  }
  return fallback;
}

function parseUseFallback(value: unknown): boolean | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return null;
}

function mapErrorToStatus(code: SmartRelatedError['code']): number {
  switch (code) {
    case 'BAD_REQUEST':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'TIMEOUT':
      return 504;
    case 'UPSTREAM_ERROR':
      return 502;
    default:
      return 500;
  }
}

interface RequestWithLogger extends Request {
  log: Logger;
}

function getLog(req: Request) {
  const base = (req as RequestWithLogger).log ?? logger;
  return base.child({ route: 'smart-related' });
}

function strategyToUxLabel(strategy: string): string {
  switch (strategy) {
    case 'deezer-related':
      return 'audio-similarity-based';
    case 'fallback-members-aggregation':
      return 'metadata-based';
    default:
      return 'metadata-based';
  }
}

export async function getSmartRelated(req: Request, res: Response) {
  const startedAt = Date.now();
  const config = getSmartRelatedConfig();
  const query = String(req.query.query ?? '').trim();
  const limit = parseLimit(req.query.limit);
  const fallbackParam = parseUseFallback(req.query.useFallback);
  const allowFallback = config.enabled && (fallbackParam ?? config.defaultUseFallback);

  const log = getLog(req);
  log.info({ query, limit, allowFallback }, 'smart-related lookup started');

  try {
    const result = await relatedByBandOrMembers(query, limit, { allowFallback });
    const tookMs = Date.now() - startedAt;
    log.info({ query, tookMs, strategy: result.strategy, cacheHit: result.cacheHit }, 'smart-related lookup succeeded');

    const uxLabel = strategyToUxLabel(result.strategy);

    const payload = SmartRelatedResponseSchema.parse({
      query,
      strategy: result.strategy,
      items: result.items.map((item) => ({ ...item, uxLabel })),
      seeds: result.seeds,
      cache: { hit: result.cacheHit },
      tookMs
    });
    res.json(payload);
  } catch (error) {
    const tookMs = Date.now() - startedAt;

    if (error instanceof SmartRelatedError) {
      // Issue 1: only trigger deterministic fallback when the original algorithm has no results.
      // In this codebase "no results" is represented by NOT_FOUND.
      if (error.code === 'NOT_FOUND' && allowFallback) {
        const fallback = await getDeterministicFallbackSimilarArtists({ log, query, limit });

        // For Issue 1 we intentionally do NOT map fallback results into the public API response yet,
        // because later issues will define provider integrations and the final response shape.
        // If fallback yields results in future issues, this is where response adaptation will happen.
        if (fallback.items.length > 0) {
          log.info({ query, tookMs, strategy: fallback.strategy }, 'smart-related deterministic fallback produced results');
        }
      }

      log.warn({ query, tookMs, code: error.code, details: error.details ?? {} }, 'smart-related lookup failed');
      const status = mapErrorToStatus(error.code);
      res.status(status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? { query }
        }
      });
      return;
    }

    log.error({ query, tookMs, err: error }, 'smart-related lookup crashed');
    res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'Unexpected error',
        details: { query }
      }
    });
  }
}
