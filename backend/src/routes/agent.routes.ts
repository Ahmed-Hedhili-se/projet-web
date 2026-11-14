import { Router } from 'express';
import * as agentController from '../controllers/agent.controller';
import { auth } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validate';
import { sendMessageSchema } from '../schemas/agent.schema';
import { idParamSchema } from '../schemas/gpu.schema';

export const agentRouter = Router();

agentRouter.use(auth);

agentRouter.get('/status', agentController.status);
agentRouter.post('/conversations', agentController.create);
agentRouter.get('/conversations', agentController.list);
agentRouter.get('/conversations/:id', validateParams(idParamSchema), agentController.getById);
agentRouter.delete('/conversations/:id', validateParams(idParamSchema), agentController.remove);
agentRouter.post('/conversations/:id/messages', validateParams(idParamSchema), validateBody(sendMessageSchema), agentController.sendMessage);
