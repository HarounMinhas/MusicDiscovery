import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createRequestLogger } from '../logger.js';

describe('createRequestLogger', () => {
  it('preserves an incoming x-request-id header', async () => {
    const app = express();
    app.use(createRequestLogger());
    app.get('/test', (req, res) => {
      const hasLogger = typeof (req as any).log?.info === 'function';
      res.json({ hasLogger, requestId: res.getHeader('x-request-id') });
    });

    const response = await request(app).get('/test').set('x-request-id', 'existing-id').expect(200);

    expect(response.headers['x-request-id']).toBe('existing-id');
    expect(response.body).toEqual({ hasLogger: true, requestId: 'existing-id' });
  });

  it('generates a request id when missing and exposes the logger', async () => {
    const app = express();
    app.use(createRequestLogger());
    app.get('/test', (req, res) => {
      const requestId = res.getHeader('x-request-id');
      const hasLogger = typeof (req as any).log?.info === 'function';
      res.json({ hasLogger, requestId });
    });

    const response = await request(app).get('/test').expect(200);

    expect(typeof response.headers['x-request-id']).toBe('string');
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    expect(response.body.hasLogger).toBe(true);
  });
});
