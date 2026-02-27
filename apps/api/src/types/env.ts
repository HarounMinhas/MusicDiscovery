import { z } from 'zod';

export const EnvSchema = z.object({
  DATA_MODE: z.enum(['tokenless', 'itunes']).default('tokenless'),
  MARKET: z.string().default('BE'),
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://localhost:4173,https://harounminhas.github.io')
    .transform((val) => {
      // Support comma-separated list of origins
      if (val === '*') return '*';
      return val.split(',').map((origin) => origin.trim());
    }),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SMART_RELATED_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return ['true', '1', 'yes', 'y'].includes(normalized);
      }
      return false;
    }),
  SMART_RELATED_CACHE_TTL_SECONDS: z.coerce.number().min(60).default(600),
  SMART_RELATED_MAX_MEMBERS: z.coerce.number().min(1).max(25).default(8),
  HTTP_DEFAULT_TIMEOUT_MS: z.coerce.number().min(1000).default(5000),
  SMART_RELATED_MUSICBRAINZ_USER_AGENT: z
    .string()
    .min(1)
    .default('MusicDiscoverySmartRelated/1.0 (musicdiscovery.local; dev@musicdiscovery.local)'),
  SMART_RELATED_MUSICBRAINZ_RATE_LIMIT_MS: z.coerce.number().min(200).max(60000).default(1000),
  LASTFM_API_KEY: z.string().min(1).optional(),
  DISCOGS_TOKEN: z.string().min(1).optional(),
  // Issue #89: Redis caching for fallback providers
  REDIS_URL: z.string().url().optional(),
  FALLBACK_LASTFM_TTL_SECONDS: z.coerce.number().min(60).default(3600),
  FALLBACK_MUSICBRAINZ_TTL_SECONDS: z.coerce.number().min(60).default(7200),
  FALLBACK_DISCOGS_TTL_SECONDS: z.coerce.number().min(60).default(7200)
});

export type Env = z.infer<typeof EnvSchema>;
