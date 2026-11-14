import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { securityHeaders } from './middlewares/securityHeaders';
import { apiRouter } from './routes';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(securityHeaders);
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);
