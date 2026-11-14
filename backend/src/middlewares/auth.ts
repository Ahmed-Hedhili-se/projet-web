import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';

export async function auth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
  }

  const payload = verifyToken(token);
  if (!payload) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token.'));
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token.'));
  }
  if (user.isBlocked) {
    return next(new AppError(403, 'ACCOUNT_BLOCKED', 'Your account has been blocked.'));
  }

  req.user = user;
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.'));
    }
    next();
  };
}
