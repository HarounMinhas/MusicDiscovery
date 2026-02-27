import type { Request, Response, NextFunction } from 'express';
import { isAppError, toErrorResponse } from '../errors/AppError.js';
import { ProviderNotImplementedError } from '@musicdiscovery/providers';
import { logger } from '../config/logger.js';
import { env } from '../env.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Handle known application errors
  if (isAppError(err)) {
    if (err.status >= 500) {
      logger.error(
        { err, url: req.url, method: req.method },
        'Server error occurred'
      );
    } else {
      logger.warn(
        { err, url: req.url, method: req.method },
        'Client error occurred'
      );
    }

    if (!res.headersSent) {
      res.status(err.status).json(toErrorResponse(err));
    }
    return;
  }

  // Handle provider not implemented errors
  if (err instanceof ProviderNotImplementedError) {
    logger.warn({ providerId: err.providerId }, 'Provider not implemented');
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

  // Handle unexpected errors
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error(
    { err: error, url: req.url, method: req.method },
    'Unhandled error occurred'
  );

  if (!res.headersSent) {
    const isDevelopment = env.NODE_ENV === 'development';
    res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'An unexpected error occurred',
        ...(isDevelopment && { stack: error.stack })
      }
    });
  }
}
