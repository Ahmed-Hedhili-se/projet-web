import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { securityHeaders } from './middlewares/securityHeaders';
import { apiRouter } from './routes';

export const app = express();                               // application Express (sans démarrage, utile pour les tests)

app.disable('x-powered-by');                                // ne révèle pas "Express" aux visiteurs
app.set('trust proxy', 'loopback');                         // req.ip fiable derrière un proxy local
app.use(securityHeaders);                                   // headers de sécurité de base
app.use(cors({ origin: env.CORS_ORIGIN }));                 // seul le frontend Angular peut appeler l'API
app.use(express.json({ limit: '100kb' }));                  // lit les body JSON

app.use('/api', apiRouter);                                 // toutes les routes de API.md

app.use(notFound);                                          // 404 pour les routes inconnues
app.use(errorHandler);                                      // format d'erreur commun, toujours en dernier
