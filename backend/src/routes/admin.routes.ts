import { Router } from 'express';
import { auth, requireRole } from '../middlewares/auth';

export const adminRouter = Router();                         // routes /api/admin/* (ajoutées à l'étape B7)

adminRouter.use(auth, requireRole('ADMIN'));                 // toutes les routes admin exigent le rôle ADMIN
