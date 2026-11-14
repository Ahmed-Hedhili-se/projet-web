import { Request, Response } from 'express';
import * as agentService from '../services/agent.service';

export async function status(req: Request, res: Response) {
  res.json(await agentService.getStatus(req.user!));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await agentService.createConversation(req.user!));
}

export async function list(req: Request, res: Response) {
  res.json(await agentService.listConversations(req.user!));
}

export async function getById(req: Request, res: Response) {
  res.json(await agentService.getConversation(req.user!, res.locals.params.id));
}

export async function remove(req: Request, res: Response) {
  await agentService.deleteConversation(req.user!, res.locals.params.id);
  res.status(204).end();
}

export async function sendMessage(req: Request, res: Response) {
  await agentService.sendMessage(req.user!, res.locals.params.id, req.body.content, res);
}
