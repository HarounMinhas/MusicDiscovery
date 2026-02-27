import pino from 'pino';
import { env } from '../env.js';

const isDevelopment = env.NODE_ENV === 'development';

const pinoConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL as string,
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  } : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.body.password',
      'req.body.token'
    ],
    censor: '[REDACTED]'
  },
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    }
  }
};

export const logger = pino(pinoConfig);

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
