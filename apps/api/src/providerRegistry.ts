import type { Request } from 'express';
import { createProvider } from '@musicdiscovery/providers';
import type { MusicProvider } from '@musicdiscovery/providers';
import { DEFAULT_PROVIDER_MODE, PROVIDERS, type ProviderId, isProviderId } from '@musicdiscovery/shared';
import { env } from './env.js';

const providers = new Map<ProviderId, MusicProvider>();

function parseMode(value: unknown): ProviderId | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (isProviderId(normalized)) {
      return normalized;
    }
  }
  return null;
}

const DEFAULT_MODE: ProviderId = parseMode(env.DATA_MODE) ?? DEFAULT_PROVIDER_MODE;

function resolveMode(value: unknown): ProviderId {
  return parseMode(value) ?? DEFAULT_MODE;
}

export function resolveProvider(req: Request): { mode: ProviderId; provider: MusicProvider } {
  const queryMode = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider;
  const headerMode = Array.isArray(req.headers['x-music-provider'])
    ? req.headers['x-music-provider'][0]
    : req.headers['x-music-provider'];
  const mode = resolveMode(queryMode ?? headerMode);
  if (!providers.has(mode)) {
    providers.set(mode, createProvider(mode));
  }
  return { mode, provider: providers.get(mode)! };
}

export function getProviderMetadata() {
  return PROVIDERS;
}

export function getDefaultProviderMode(): ProviderId {
  return DEFAULT_MODE;
}
