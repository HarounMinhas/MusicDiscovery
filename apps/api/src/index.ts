import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ProviderNotImplementedError } from '@musicdiscovery/providers';
import musicRoutes from './routes/music.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { env } from './env.js';
import { HttpError, toErrorResponse } from './errors.js';
import { createRequestLogger, logger } from './logger.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(createRequestLogger());
app.use(apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: env.DATA_MODE });
});

app.use('/api', musicRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      logger.error({ err }, 'Unhandled HTTP error');
    }
    if (!res.headersSent) {
      res.status(err.status).json(toErrorResponse(err));
    }
    return;
  }

  if (err instanceof ProviderNotImplementedError) {
    if (!res.headersSent) {
      res.status(501).json({
        error: {
          code: 'provider_not_implemented',
          message: err.message,
          details: { providerId: err.providerId }
        }
      });
    }
    return;
  }

  logger.error({ err }, 'Unhandled server error');
  if (!res.headersSent) {
    res.status(500).json({ error: { code: 'server_error', message: 'Unexpected error' } });
  }
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, mode: env.DATA_MODE }, 'API listening');
});
