import { NextFunction, Request, Response } from 'express';
import { redis } from '../lib/redis';
import { AppError } from '../utils/AppError';

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

export function loginAttemptsKey(ip: string, email: string): string {
  return `login-failures:${ip}:${email}`;
}

async function safely<T>(action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch (err) {
    console.error('Login rate limit skipped (Redis unavailable):', (err as Error).message);
    return fallback;
  }
}

export async function rateLimitLogin(req: Request, _res: Response, next: NextFunction) {
  const key = loginAttemptsKey(req.ip ?? 'unknown', req.body.email);
  const failures = await safely(async () => Number(await redis.get(key)) || 0, 0);
  if (failures >= MAX_LOGIN_FAILURES) {
    return next(new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed login attempts. Please try again in 15 minutes.'));
  }
  next();
}

export async function recordLoginFailure(ip: string, email: string) {
  const key = loginAttemptsKey(ip, email);
  await safely(async () => {
    const failures = await redis.incr(key);
    if (failures === 1) await redis.expire(key, LOGIN_WINDOW_SECONDS);
  }, undefined);
}

export async function resetLoginFailures(ip: string, email: string) {
  await safely(() => redis.del(loginAttemptsKey(ip, email)), 0);
}
