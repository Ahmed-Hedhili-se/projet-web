import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError';

function toValidationError(error: z.ZodError): AppError {  // erreurs Zod → format VALIDATION_ERROR de API.md
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',                  // ex. "email"
    message: issue.message,
  }));
  return new AppError(400, 'VALIDATION_ERROR', 'Invalid request data.', details);
}

export function validateBody(schema: z.ZodType) {          // vérifie req.body et le remplace par la version nettoyée
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(toValidationError(result.error));
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodType) {         // vérifie req.query, résultat dans res.locals.query
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(toValidationError(result.error));
    res.locals.query = result.data;                         // Express 5 : req.query est en lecture seule
    next();
  };
}
