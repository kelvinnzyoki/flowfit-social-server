import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { allowedOrigins, isProduction } from './config/env';
import healthRoutes from './routes/health.routes';
import socialRoutes from './routes/social.routes';
import errorMiddleware from './middleware/error';
import HttpError from './utils/httpError';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new HttpError(403, 'Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 300 : 3000,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'FlowFit Social Server', routes: ['/api/health', '/api/social'] });
});

app.use('/api/health', healthRoutes);
app.use('/api/social', socialRoutes);

app.use((_req, _res, next) => next(new HttpError(404, 'Route not found')));

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ ok: false, error: 'Validation failed', issues: err.flatten() });
  }
  return errorMiddleware(err as Error, req, res, next);
});

export default app;
