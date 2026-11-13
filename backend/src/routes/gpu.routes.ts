import { Router } from 'express';
import * as gpuController from '../controllers/gpu.controller';
import { validateParams, validateQuery } from '../middlewares/validate';
import { gpuListQuerySchema, idParamSchema, periodQuerySchema } from '../schemas/gpu.schema';

export const gpuRouter = Router();                          // routes publiques /api/gpus/*

gpuRouter.get('/', validateQuery(gpuListQuerySchema), gpuController.list);
gpuRouter.get('/:id', validateParams(idParamSchema), validateQuery(periodQuerySchema), gpuController.getById);
