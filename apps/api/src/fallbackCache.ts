import { createClient } from 'redis';
import type { Logger } from 'pino';
import { env } from './env.js';
import { logger as appLogger } from './logger.js';

const DEFAULT_TTL_SECONDS = 3600;

export interface FallbackCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

class InMemoryFallbackCache implements FallbackCache {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private log: Logger;

  constructor(log: Logger) {
    this.log = log;
    this.log.info('InMemoryFallbackCache initialized (no REDIS_URL configured)');
    this.startCleanupTimer();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  private startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      let removed = 0;
      for (const [key, entry] of this.store.entries()) {
        if (now >= entry.expiresAt) {
          this.store.delete(key);
          removed++;
        }
      }
      if (removed > 0) {
        this.log.debug({ removed }, 'Cleaned up expired in-memory cache entries');
      }
    }, 60_000);
  }
}

class RedisFallbackCache implements FallbackCache {
  private client: any;
  private log: Logger;
  private ready = false;

  constructor(client: any, log: Logger) {
    this.client = client;
    this.log = log;
  }

  async connect(): Promise<void> {
    if (this.ready) return;
    await this.client.connect();
    this.ready = true;
    this.log.info('RedisFallbackCache connected');
  }

  async get(key: string): Promise<string | null> {
    if (!this.ready) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      this.log.warn({ err: error, key }, 'Redis GET failed (swallowed)');
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.ready) return;
    try {
      await this.client.setEx(key, ttlSeconds, value);
    } catch (error) {
      this.log.warn({ err: error, key, ttlSeconds }, 'Redis SETEX failed (swallowed)');
    }
  }

  async del(key: string): Promise<void> {
    if (!this.ready) return;
    try {
      await this.client.del(key);
    } catch (error) {
      this.log.warn({ err: error, key }, 'Redis DEL failed (swallowed)');
    }
  }
}

let cacheInstance: FallbackCache | null = null;

export async function getFallbackCache(): Promise<FallbackCache> {
  if (cacheInstance) return cacheInstance;

  const log = appLogger.child({ module: 'fallback-cache' });

  if (env.REDIS_URL) {
    try {
      const client = createClient({ url: env.REDIS_URL });
      const redisCache = new RedisFallbackCache(client, log);
      await redisCache.connect();
      cacheInstance = redisCache;
      return cacheInstance;
    } catch (error) {
      log.warn({ err: error }, 'Failed to connect to Redis; falling back to in-memory cache');
    }
  }

  cacheInstance = new InMemoryFallbackCache(log);
  return cacheInstance;
}

export function getTTLForProvider(provider: 'lastfm' | 'musicbrainz' | 'discogs'): number {
  switch (provider) {
    case 'lastfm':
      return env.FALLBACK_LASTFM_TTL_SECONDS ?? DEFAULT_TTL_SECONDS;
    case 'musicbrainz':
      return env.FALLBACK_MUSICBRAINZ_TTL_SECONDS ?? DEFAULT_TTL_SECONDS;
    case 'discogs':
      return env.FALLBACK_DISCOGS_TTL_SECONDS ?? DEFAULT_TTL_SECONDS;
    default:
      return DEFAULT_TTL_SECONDS;
  }
}
