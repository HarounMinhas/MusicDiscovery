import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import musicRoutes from './routes/music.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { env } from './env.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan('combined'));
app.use(apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: env.DATA_MODE });
});

app.use('/api', musicRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: 'server_error', message: 'Unexpected error' } });
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (mode=${env.DATA_MODE})`);
});
