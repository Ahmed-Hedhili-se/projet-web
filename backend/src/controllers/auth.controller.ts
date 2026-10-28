import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { toPublicUser } from '../utils/serializers';

export async function register(req: Request, res: Response) { // POST /api/auth/register
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {    // POST /api/auth/login
  const result = await authService.login(req.body, req.ip ?? 'unknown');
  res.json(result);
}

export function me(req: Request, res: Response) {             // GET /api/auth/me (req.user rempli par auth)
  res.json({ user: toPublicUser(req.user!) });
}
