import type { Request } from 'express';
import type { Logger } from 'pino';
import { createProvider, MusicProvider } from '@musicdiscovery/providers';
import { DEFAULT_PROVIDER_MODE, PROVIDERS, type ProviderId, isProviderId } from '@musicdiscovery/shared';
import { env } from './env.js';
import { HttpError } from './errors.js';

class InvalidProviderError extends HttpError {
  constructor(value: unknown) {
    const provided = typeof value === 'string' ? value : value === undefined ? 'undefined' : JSON.stringify(value);
    super(400, 'invalid_provider', `Unsupported music provider "${provided}"`);
  }
}

const providers = new Map<ProviderId, MusicProvider>();

// GitHub Pages deployment: public endpoints only.
// Tokenless = Deezer-first (no OAuth), plus iTunes links.
const ENABLED_PROVIDER_IDS: ProviderId[] = ['tokenless', 'itunes'];
const ENABLED_PROVIDER_SET = new Set<ProviderId>(ENABLED_PROVIDER_IDS);

function parseMode(value: unknown): ProviderId | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (isProviderId(normalized) && ENABLED_PROVIDER_SET.has(normalized)) {
      return normalized;
    }
  }
  return null;
}

const DEFAULT_MODE: ProviderId = (() => {
  const parsed = parseMode(env.DATA_MODE);
  if (parsed) return parsed;
  return ENABLED_PROVIDER_SET.has(DEFAULT_PROVIDER_MODE) ? DEFAULT_PROVIDER_MODE : ENABLED_PROVIDER_IDS[0]!;
})();

interface RequestWithLogger extends Request {
  log: Logger;
  __providerLogEnhanced?: boolean;
}

export function resolveProvider(req: Request): { mode: ProviderId; provider: MusicProvider } {
  const queryMode = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider;
  const headerMode = Array.isArray(req.headers['x-music-provider'])
    ? req.headers['x-music-provider'][0]
    : req.headers['x-music-provider'];
  const requestedMode = queryMode ?? headerMode;
  const parsedMode = parseMode(requestedMode);
  if (parsedMode === null && requestedMode !== undefined) {
    throw new InvalidProviderError(requestedMode);
  }

  const mode = parsedMode ?? DEFAULT_MODE;
  const requestWithLogger = req as RequestWithLogger;
  if (requestWithLogger.log && !requestWithLogger.__providerLogEnhanced) {
    requestWithLogger.log = requestWithLogger.log.child({ providerMode: mode });
    requestWithLogger.__providerLogEnhanced = true;
  }
  if (!providers.has(mode)) {
    providers.set(
      mode,
      createProvider(mode, {
        http: { timeoutMs: env.HTTP_DEFAULT_TIMEOUT_MS }
      })
    );
  }
  return { mode, provider: providers.get(mode)! };
}

export function getProviderMetadata() {
  return PROVIDERS.filter((provider) => ENABLED_PROVIDER_SET.has(provider.id));
}

export function getDefaultProviderMode(): ProviderId {
  return DEFAULT_MODE;
}
