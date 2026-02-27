import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import musicRoutes from './routes/music.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { env } from './env.js';
import { createRequestLogger, logger } from './logger.js';
import { errorHandler } from './utils/errorHandler.js';

const app = express();

// Trust proxy when behind a reverse proxy (e.g. Render sets X-Forwarded-For)
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security and parsing middleware
app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);

// Logging middleware
app.use(createRequestLogger());

// Rate limiting
app.use(apiRateLimiter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: env.DATA_MODE,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

// API routes
app.use('/api', musicRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      mode: env.DATA_MODE,
      environment: env.NODE_ENV,
      corsOrigins: env.CORS_ORIGIN
    },
    'MusicDiscovery API server started'
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app };
