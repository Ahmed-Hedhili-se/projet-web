import { Router } from 'express';
import { auth, requireRole } from '../middlewares/auth';

export const adminRouter = Router();

adminRouter.use(auth, requireRole('ADMIN'));
