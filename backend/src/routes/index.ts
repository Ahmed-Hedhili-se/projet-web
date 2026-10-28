import { Router } from 'express';
import { adminRouter } from './admin.routes';
import { authRouter } from './auth.routes';

export const apiRouter = Router();                          // regroupe toutes les routes sous /api

apiRouter.get('/health', (_req, res) => {                   // vérifie que l'API répond
  res.json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
