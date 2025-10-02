import { config } from 'dotenv';
import { z } from 'zod';

config();

const EnvSchema = z.object({
  DATA_MODE: z.enum(['tokenless', 'spotify', 'itunes']).default('tokenless'),
  MARKET: z.string().default('BE'),
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGIN: z.string().default('*'),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().optional()
}).superRefine((val, ctx) => {
  if (val.DATA_MODE === 'spotify') {
    if (!val.SPOTIFY_CLIENT_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_CLIENT_ID'], message: 'Required in spotify mode' });
    if (!val.SPOTIFY_CLIENT_SECRET) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_CLIENT_SECRET'], message: 'Required in spotify mode' });
    if (!val.SPOTIFY_REDIRECT_URI) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SPOTIFY_REDIRECT_URI'], message: 'Required in spotify mode' });
  }
});

export const env = EnvSchema.parse(process.env);
