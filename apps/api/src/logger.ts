import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';

import { env } from './env.js';

export const logger = pino({ level: env.LOG_LEVEL });

export function createRequestLogger() {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const existing = req.headers['x-request-id'];
      if (typeof existing === 'string' && existing.length > 0) {
        res.setHeader('x-request-id', existing);
        return existing;
      }
      const id = randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    }
  });
}
