// Conseiller IA : conversations, quota quotidien et envoi d'un message avec réponse en flux SSE.
import { AgentConversation, Prisma, User } from '@prisma/client';
import { Response } from 'express';
import { getLlmProvider, LlmError } from '../agent/llm';
import { runAgentTurn } from '../agent/loop';
import { PartialProfile } from '../agent/profile';
import { RankResult } from '../agent/rankConfigs';
import { Fact } from '../agent/repoAnalyzer';
import { AgentState } from '../agent/tools';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { toAgentMessage, toConversation } from '../utils/serializers';

const withCount = { _count: { select: { messages: true } } } as const; // nombre de messages pour l'objet AgentConversation

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function messagesUsedToday(userId: number): Promise<number> { // quota compté en base (pas dans Redis)
  return prisma.agentMessage.count({
    where: { role: 'USER', createdAt: { gte: startOfTodayUtc() }, conversation: { userId } },
  });
}

async function findOwnConversation(userId: number, id: number) { // 404 si inexistante ou à quelqu'un d'autre
  const conversation = await prisma.agentConversation.findFirst({ where: { id, userId }, include: withCount });
  if (!conversation) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  return conversation;
}

export async function getStatus(user: User) {               // GET /agent/status
  const provider = getLlmProvider();
  return {
    available: provider.isConfigured(),
    model: provider.model,
    dailyMessageLimit: env.AGENT_DAILY_LIMIT,
    messagesUsedToday: await messagesUsedToday(user.id),
  };
}

export async function createConversation(user: User) {      // POST /agent/conversations
  const conversation = await prisma.agentConversation.create({ data: { userId: user.id }, include: withCount });
  return { conversation: toConversation(conversation) };
}

export async function listConversations(user: User) {       // GET /agent/conversations
  const conversations = await prisma.agentConversation.findMany({
    where: { userId: user.id }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], include: withCount,
  });
  return { conversations: conversations.map(toConversation), total: conversations.length };
}

export async function getConversation(user: User, id: number) { // GET /agent/conversations/:id
  const conversation = await findOwnConversation(user.id, id);
  const messages = await prisma.agentMessage.findMany({ where: { conversationId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return { conversation: toConversation(conversation), messages: messages.map(toAgentMessage) };
}

export async function deleteConversation(user: User, id: number) { // DELETE /agent/conversations/:id (messages supprimés en cascade)
  await findOwnConversation(user.id, id);
  await prisma.agentConversation.delete({ where: { id } });
}

function stateOf(conversation: AgentConversation): AgentState { // colonnes JSON → état de l'agent
  const stored = conversation.workloadProfile as { profile?: PartialProfile; facts?: Fact[] } | null;
  return {
    repoUrl: conversation.repoUrl,
    profile: stored?.profile ?? {},
    facts: stored?.facts ?? [],
    lastRanking: (conversation.lastRanking as RankResult | null) ?? null,
  };
}

function sendEvent(res: Response, event: string, data: unknown) { // format SSE : "event: …" puis "data: …" puis une ligne vide
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function sendMessage(user: User, id: number, content: string, res: Response) { // POST /agent/conversations/:id/messages
  const conversation = await findOwnConversation(user.id, id); // vérifications AVANT le flux : réponses JSON normales
  if (!getLlmProvider().isConfigured()) {
    throw new AppError(503, 'AGENT_UNAVAILABLE', 'The AI advisor is not available right now.');
  }
  if ((await messagesUsedToday(user.id)) >= env.AGENT_DAILY_LIMIT) {
    throw new AppError(429, 'AGENT_DAILY_LIMIT', `You reached the limit of ${env.AGENT_DAILY_LIMIT} messages per day. Come back tomorrow.`);
  }

  res.writeHead(200, {                                      // début du flux SSE
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',                              // pas de mise en tampon par un proxy
  });

  const history = await prisma.agentMessage.findMany({
    where: { conversationId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { role: true, content: true },
  });
  const userMessage = await prisma.agentMessage.create({ data: { conversationId: id, role: 'USER', content } });
  sendEvent(res, 'user_message', { message: toAgentMessage(userMessage) });

  try {
    const turn = await runAgentTurn({
      history, userText: content, state: stateOf(conversation),
      onStep: (step) => sendEvent(res, 'step', step),
      onCard: (card) => sendEvent(res, 'card', { card }),
    });
    sendEvent(res, 'text', { delta: turn.content });         // texte complet en un morceau (le frontend concatène les "delta")

    const [assistant, updated] = await prisma.$transaction([
      prisma.agentMessage.create({
        data: {
          conversationId: id, role: 'ASSISTANT', content: turn.content,
          steps: turn.steps as unknown as Prisma.InputJsonValue, cards: turn.cards as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.agentConversation.update({
        where: { id },
        data: {
          title: conversation.title === 'New conversation' ? titleFrom(content) : undefined, // titre = début du 1er message
          repoUrl: turn.state.repoUrl,
          workloadProfile: { profile: turn.state.profile, facts: turn.state.facts } as unknown as Prisma.InputJsonValue,
          lastRanking: (turn.state.lastRanking ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
          inputTokens: { increment: turn.usage.inputTokens },
          outputTokens: { increment: turn.usage.outputTokens },
        },
        include: withCount,
      }),
    ]);
    sendEvent(res, 'done', { message: toAgentMessage(assistant), conversation: toConversation(updated) });
  } catch (err) {
    if (!(err instanceof LlmError)) console.error(err);     // erreur inattendue : log serveur, message générique au client
    const message = err instanceof LlmError ? err.message : 'The AI advisor hit an unexpected error. Please try again.';
    sendEvent(res, 'error', { error: { code: 'AGENT_ERROR', message } });
  } finally {
    res.end();
  }
}

function titleFrom(content: string): string {               // "Here's my repo: https://… which GPU?" → 60 caractères max
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}...` : oneLine;
}
