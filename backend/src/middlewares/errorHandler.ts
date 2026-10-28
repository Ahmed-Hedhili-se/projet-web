import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export function notFound(_req: Request, _res: Response, next: NextFunction) { // aucune route ne correspond
  next(new AppError(404, 'NOT_FOUND', 'Route not found.'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {                            // erreur prévue : on renvoie son code et son message
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),   // details uniquement s'il y en a
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {        // JSON mal formé envoyé par le client
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body.', details: [] },
    });
    return;
  }

  console.error(err);                                       // erreur inattendue : log côté serveur
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}
