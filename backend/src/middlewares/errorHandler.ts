import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found.'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (isBodyParserError(err, 'entity.too.large')) {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body.', details: [] },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}

function isBodyParserError(err: unknown, type: string): boolean {
  return typeof err === 'object' && err !== null && 'type' in err && err.type === type;
}
