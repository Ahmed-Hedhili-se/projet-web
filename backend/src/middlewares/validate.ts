import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError';

function toValidationError(error: z.ZodError): AppError {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
  return new AppError(400, 'VALIDATION_ERROR', 'Invalid request data.', details);
}

export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(toValidationError(result.error));
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(toValidationError(result.error));
    res.locals.query = result.data;
    next();
  };
}

export function validateParams(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(toValidationError(result.error));
    res.locals.params = result.data;
    next();
  };
}
