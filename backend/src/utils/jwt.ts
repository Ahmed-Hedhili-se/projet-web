import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';

export interface TokenPayload {
  userId: number;                                           // id de l'utilisateur (stocké dans "sub")
  role: Role;                                               // USER ou ADMIN
}

export function signToken(userId: number, role: Role): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: String(userId),                                // "sub" doit être une chaîne
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'], // 24 h par défaut
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): TokenPayload | null { // null si le token est invalide ou expiré
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
