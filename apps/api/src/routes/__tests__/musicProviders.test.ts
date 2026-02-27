import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function createApp() {
  const [{ default: musicRoutes }, { HttpError, toErrorResponse }, { ProviderNotImplementedError }] = await Promise.all([
    import('../../routes/music.js'),
    import('../../errors.js'),
    import('@musicdiscovery/providers')
  ]);

  const app = express();
  app.use(express.json());
  app.use('/api', musicRoutes);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json(toErrorResponse(err));
      return;
    }
    if (err instanceof ProviderNotImplementedError) {
      res.status(501).json({
        error: {
          code: 'provider_not_implemented',
          message: err.message,
          details: { providerId: err.providerId }
        }
      });
      return;
    }
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: { code: 'server_error', message: errorMessage } });
  });
  return app;
}

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key as keyof NodeJS.ProcessEnv];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('music provider selection', () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('returns 400 when query contains an unsupported provider', async () => {
    const app = await createApp();
    const response = await request(app)
      .get('/api/music/search')
      .query({ query: 'radiohead', provider: 'invalid' })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: 'invalid_provider',
        message: 'Unsupported music provider "invalid"'
      }
    });
  });

  it('returns 400 when header contains an unsupported provider', async () => {
    const app = await createApp();
    const response = await request(app)
      .get('/api/music/search')
      .set('x-music-provider', 'bad-provider')
      .query({ query: 'muse' })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: 'invalid_provider',
        message: 'Unsupported music provider "bad-provider"'
      }
    });
  });

  it('returns 501 when spotify provider is enabled but not implemented', async () => {
    process.env.SPOTIFY_ENABLED = 'true';
    process.env.DATA_MODE = 'spotify';
    process.env.SPOTIFY_CLIENT_ID = 'test-client';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-secret';
    process.env.SPOTIFY_REDIRECT_URI = 'http://localhost/callback';

    const app = await createApp();
    const response = await request(app)
      .get('/api/music/search')
      .query({ query: 'radiohead', provider: 'spotify' })
      .expect(501);

    expect(response.body).toEqual({
      error: {
        code: 'provider_not_implemented',
        message: 'Provider "spotify" is not implemented',
        details: { providerId: 'spotify' }
      }
    });
  });
});
