import { NextFunction, Request, Response } from 'express';
import { redis } from '../lib/redis';
import { AppError } from '../utils/AppError';

export const MAX_LOGIN_FAILURES = 5;                        // 5 échecs autorisés…
export const LOGIN_WINDOW_SECONDS = 15 * 60;                // …sur 15 minutes

export function loginAttemptsKey(ip: string, email: string): string { // un compteur par couple IP + email
  return `login-failures:${ip}:${email}`;
}

async function safely<T>(action: () => Promise<T>, fallback: T): Promise<T> { // Redis en panne : le login reste possible
  try {
    return await action();
  } catch (err) {
    console.error('Login rate limit skipped (Redis unavailable):', (err as Error).message);
    return fallback;
  }
}

export async function rateLimitLogin(req: Request, _res: Response, next: NextFunction) { // après validateBody(loginSchema)
  const key = loginAttemptsKey(req.ip ?? 'unknown', req.body.email);
  const failures = await safely(async () => Number(await redis.get(key)) || 0, 0);
  if (failures >= MAX_LOGIN_FAILURES) {
    return next(new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed login attempts. Please try again in 15 minutes.'));
  }
  next();
}

export async function recordLoginFailure(ip: string, email: string) { // +1 échec, le compteur expire après 15 min
  const key = loginAttemptsKey(ip, email);
  await safely(async () => {
    const failures = await redis.incr(key);
    if (failures === 1) await redis.expire(key, LOGIN_WINDOW_SECONDS); // la fenêtre démarre au premier échec
  }, undefined);
}

export async function resetLoginFailures(ip: string, email: string) { // login réussi : on remet à zéro
  await safely(() => redis.del(loginAttemptsKey(ip, email)), 0);
}
