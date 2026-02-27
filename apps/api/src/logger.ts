// Re-export from config for backward compatibility
export { logger, createChildLogger } from './config/logger.js';

import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from './config/logger.js';

// pino-http v11's ESM/CJS interop can cause the default import to not be callable
// under some TS/NodeNext setups. Import as namespace and select the callable export.
import * as pinoHttpImport from 'pino-http';

const pinoHttp =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((pinoHttpImport as any).default ?? pinoHttpImport) as unknown as (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opts: any
  ) => any;

export function createRequestLogger() {
  return pinoHttp({
    logger,
    genReqId(req: Request, res: Response) {
      const existing = req.headers['x-request-id'];
      if (typeof existing === 'string' && existing.length > 0) {
        res.setHeader('x-request-id', existing);
        return existing;
      }
      const id = randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    }
  });
}
