import { Request, Response } from 'express';
import * as gpuService from '../services/gpu.service';

export async function list(_req: Request, res: Response) {
  res.json(await gpuService.listGpus(res.locals.query));
}

export async function getById(_req: Request, res: Response) {
  res.json(await gpuService.getGpu(res.locals.params.id, res.locals.query));
}
