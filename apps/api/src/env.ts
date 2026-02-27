import { config } from 'dotenv';
import { EnvSchema, type Env } from './types/env.js';

config();

export const env: Env = EnvSchema.parse(process.env);

export type { Env };
