import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';

export interface TokenPayload {
  userId: number;
  role: Role;
}

export function signToken(userId: number, role: Role): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) return null;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) return null;
    return { userId, role: payload.role as Role };
  } catch {
    return null;
  }
}
