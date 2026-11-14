import { Router } from 'express';
import { adminRouter } from './admin.routes';
import { agentRouter } from './agent.routes';
import { authRouter } from './auth.routes';
import { gpuRouter } from './gpu.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/gpus', gpuRouter);
apiRouter.use('/agent', agentRouter);
apiRouter.use('/admin', adminRouter);
