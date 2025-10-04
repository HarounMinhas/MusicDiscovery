import { config } from 'dotenv';
import { z } from 'zod';

config();

const EnvSchema = z
  .object({
    DATA_MODE: z.enum(['tokenless', 'spotify', 'itunes']).default('tokenless'),
    MARKET: z.string().default('BE'),
    PORT: z.coerce.number().default(8080),
    NODE_ENV: z.string().default('development'),
    CORS_ORIGIN: z.string().default('*'),
    SPOTIFY_CLIENT_ID: z.string().optional(),
    SPOTIFY_CLIENT_SECRET: z.string().optional(),
    SPOTIFY_REDIRECT_URI: z.string().optional(),
    SMART_RELATED_ENABLED: z.coerce.boolean().default(false),
    SMART_RELATED_CACHE_TTL_SECONDS: z.coerce.number().min(60).default(600),
    SMART_RELATED_MAX_MEMBERS: z.coerce.number().min(1).max(25).default(8),
    HTTP_DEFAULT_TIMEOUT_MS: z.coerce.number().min(1000).default(5000)
  })
  .superRefine((val, ctx) => {
  if (val.DATA_MODE === 'spotify') {
    if (!val.SPOTIFY_CLIENT_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_CLIENT_ID'], message: 'Required in spotify mode' });
    if (!val.SPOTIFY_CLIENT_SECRET) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_CLIENT_SECRET'], message: 'Required in spotify mode' });
    if (!val.SPOTIFY_REDIRECT_URI) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_REDIRECT_URI'], message: 'Required in spotify mode' });
  }
});

export const env = EnvSchema.parse(process.env);
