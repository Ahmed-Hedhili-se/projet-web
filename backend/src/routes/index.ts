import { Router } from 'express';

export const apiRouter = Router();                          // regroupe toutes les routes sous /api

apiRouter.get('/health', (_req, res) => {                   // vérifie que l'API répond
  res.json({ status: 'ok' });
});
