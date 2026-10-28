import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { auth } from '../middlewares/auth';
import { rateLimitLogin } from '../middlewares/rateLimitLogin';
import { validateBody } from '../middlewares/validate';
import { loginSchema, registerSchema } from '../schemas/auth.schema';

export const authRouter = Router();                          // routes /api/auth/*

authRouter.post('/register', validateBody(registerSchema), authController.register);
authRouter.post('/login', validateBody(loginSchema), rateLimitLogin, authController.login); // validation, puis limite Redis
authRouter.get('/me', auth, authController.me);
