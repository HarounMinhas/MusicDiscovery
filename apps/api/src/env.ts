import { config } from 'dotenv';
import { z } from 'zod';

import { parseBoolean } from './utils/parseBoolean';

config();

const EnvSchema = z
  .object({
    DATA_MODE: z.enum(['tokenless', 'spotify', 'itunes']).default('tokenless'),
    MARKET: z.string().default('BE'),
    PORT: z.coerce.number().default(8080),
    NODE_ENV: z.string().default('development'),
    CORS_ORIGIN: z.string().default('*'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SPOTIFY_CLIENT_ID: z.string().optional(),
    SPOTIFY_CLIENT_SECRET: z.string().optional(),
    SPOTIFY_REDIRECT_URI: z.string().optional(),
    SPOTIFY_ENABLED: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => parseBoolean(value, false)),
    SMART_RELATED_ENABLED: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => parseBoolean(value, false)),
    SMART_RELATED_CACHE_TTL_SECONDS: z.coerce.number().min(60).default(600),
    SMART_RELATED_MAX_MEMBERS: z.coerce.number().min(1).max(25).default(8),
    HTTP_DEFAULT_TIMEOUT_MS: z.coerce.number().min(1000).default(5000),
    SMART_RELATED_MUSICBRAINZ_USER_AGENT: z
      .string()
      .min(1)
      .default('MusicDiscoverySmartRelated/1.0 (musicdiscovery.local; dev@musicdiscovery.local)'),
    SMART_RELATED_MUSICBRAINZ_RATE_LIMIT_MS: z.coerce.number().min(200).max(60000).default(1000)
  })
  .superRefine((val, ctx) => {
  if (val.DATA_MODE === 'spotify' && val.SPOTIFY_ENABLED) {
    if (!val.SPOTIFY_CLIENT_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_CLIENT_ID'], message: 'Required in spotify mode' });
    if (!val.SPOTIFY_CLIENT_SECRET) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_CLIENT_SECRET'], message: 'Required in spotify mode' });
    if (!val.SPOTIFY_REDIRECT_URI) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_REDIRECT_URI'], message: 'Required in spotify mode' });
  }
});

export const env = EnvSchema.parse(process.env);
