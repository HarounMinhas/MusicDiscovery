import express from 'express';
import request from 'supertest';
import { ReadableStream } from 'node:stream/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { clearCache } from '../../cache.js';

let resolveProviderSpy: Mock;
let getProviderMetadataSpy: Mock;
let getDefaultProviderModeSpy: Mock;

async function createApp() {
  const [{ default: musicRoutes }] = await Promise.all([import('../../routes/music.js')]);
  const app = express();
  app.use(express.json());
  app.use('/api', musicRoutes);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: { code: 'server_error', message: errorMessage } });
  });
  return app;
}

describe('preview proxy', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    clearCache();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);

    const providerRegistry = await import('../../providerRegistry.js');
    resolveProviderSpy = vi.spyOn(providerRegistry, 'resolveProvider') as Mock;
    getProviderMetadataSpy = vi
      .spyOn(providerRegistry, 'getProviderMetadata')
      .mockReturnValue([]) as Mock;
    getDefaultProviderModeSpy = vi
      .spyOn(providerRegistry, 'getDefaultProviderMode')
      .mockReturnValue('tokenless') as Mock;
  });

  afterEach(() => {
    resolveProviderSpy?.mockRestore();
    getProviderMetadataSpy?.mockRestore();
    getDefaultProviderModeSpy?.mockRestore();
    vi.unstubAllGlobals();
  });

  it('rejects previews with a non-audio content type', async () => {
    const getTrack = vi.fn().mockResolvedValue({
      id: 'deezer:1',
      previewUrl: 'https://example.com/preview.mp3'
    });
    resolveProviderSpy.mockReturnValue({ mode: 'tokenless', provider: { getTrack } });

    fetchMock.mockResolvedValue(
      new Response('nope', {
        status: 200,
        headers: {
          'content-type': 'text/plain'
        }
      })
    );

    const app = await createApp();
    const response = await request(app)
      .get(`/api/music/tracks/${encodeURIComponent('deezer:1')}/preview`)
      .expect(415);

    expect(response.body).toEqual({
      error: {
        code: 'preview_unsupported',
        message: 'Voorbeeld is geen audio-bestand'
      }
    });
    expect(getTrack).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects previews that exceed the size limit via content-length', async () => {
    const getTrack = vi.fn().mockResolvedValue({
      id: 'deezer:2',
      previewUrl: 'https://example.com/large.mp3'
    });
    resolveProviderSpy.mockReturnValue({ mode: 'tokenless', provider: { getTrack } });

    fetchMock.mockResolvedValue(
      new Response('too big', {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'content-length': String(10 * 1024 * 1024 + 1)
        }
      })
    );

    const app = await createApp();
    const response = await request(app)
      .get(`/api/music/tracks/${encodeURIComponent('deezer:2')}/preview`)
      .expect(413);

    expect(response.body).toEqual({
      error: {
        code: 'preview_too_large',
        message: 'Preview-audio is groter dan 10 MB'
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects streaming previews that exceed the limit without content-length', async () => {
    const getTrack = vi.fn().mockResolvedValue({
      id: 'deezer:3',
      previewUrl: 'https://example.com/stream.mp3'
    });
    resolveProviderSpy.mockReturnValue({ mode: 'tokenless', provider: { getTrack } });

    const limit = 10 * 1024 * 1024;
    const chunk = new Uint8Array(limit + 1);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.close();
      }
    });

    fetchMock.mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg'
        }
      })
    );

    const app = await createApp();
    const response = await request(app)
      .get(`/api/music/tracks/${encodeURIComponent('deezer:3')}/preview`)
      .expect(413);

    expect(response.body).toEqual({
      error: {
        code: 'preview_too_large',
        message: 'Preview-audio is groter dan 10 MB'
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
