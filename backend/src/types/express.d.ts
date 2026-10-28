import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;                                          // rempli par le middleware auth (utilisateur relu en base)
    }
  }
}

export {};
