import type { Request, Response } from 'express';
import { SmartRelatedResponseSchema } from '@musicdiscovery/shared';
import { relatedByBandOrMembers } from '../services/smartRelatedService.js';
import { getSmartRelatedConfig } from '../services/smartRelatedConfig.js';
import { SmartRelatedError } from '../services/errors.js';

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

export async function getSmartRelated(req: Request, res: Response) {
  const startedAt = Date.now();
  const config = getSmartRelatedConfig();
  const query = String(req.query.query ?? '').trim();
  const limit = parseLimit(req.query.limit);
  const fallbackParam = parseUseFallback(req.query.useFallback);
  const allowFallback = config.enabled && (fallbackParam ?? config.defaultUseFallback);

  console.log(`[smart-related] start query="${query}" limit=${limit} fallback=${allowFallback}`);

  try {
    const result = await relatedByBandOrMembers(query, limit, { allowFallback });
    const tookMs = Date.now() - startedAt;
    console.log(`[smart-related] success query="${query}" strategy=${result.strategy} tookMs=${tookMs}`);
    const payload = SmartRelatedResponseSchema.parse({
      query,
      strategy: result.strategy,
      items: result.items,
      seeds: result.seeds,
      cache: { hit: result.cacheHit },
      tookMs
    });
    res.json(payload);
  } catch (error) {
    const tookMs = Date.now() - startedAt;
    if (error instanceof SmartRelatedError) {
      console.warn(
        `[smart-related] failed query="${query}" code=${error.code} tookMs=${tookMs}`,
        error.details ?? {}
      );
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
    console.error(`[smart-related] unexpected error query="${query}"`, error);
    res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'Unexpected error',
        details: { query }
      }
    });
  }
}
