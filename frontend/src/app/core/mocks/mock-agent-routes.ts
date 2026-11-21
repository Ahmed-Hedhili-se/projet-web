import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AgentStatus } from '../models/agent';
import {
  MOCK_AGENT_DAILY_LIMIT,
  MOCK_AGENT_MODEL,
  allMockConversations,
  createMockConversation,
  mockMessagesUsedToday,
  saveMockConversations,
} from './mock-agent';
import { fail, respond, withAccount } from './mock-http';

export function handleAgentRoutes(
  req: HttpRequest<unknown>,
  path: string,
): Observable<HttpResponse<unknown>> | null {
  if (!path.startsWith('/agent/')) {
    return null;
  }
  if (req.method === 'GET' && path === '/agent/status') {
    return withAccount(req, (account) => {
      // disponibilité et quota du jour
      const status: AgentStatus = {
        available: true,
        model: MOCK_AGENT_MODEL,
        dailyMessageLimit: MOCK_AGENT_DAILY_LIMIT,
        messagesUsedToday: mockMessagesUsedToday(account.user.id),
      };
      return respond(status);
    });
  }
  if (req.method === 'POST' && path === '/agent/conversations') {
    return withAccount(req, (account) =>
      respond({ conversation: createMockConversation(account.user.id) }, 300, 201),
    );
  }
  if (req.method === 'GET' && path === '/agent/conversations') {
    return withAccount(req, (account) => {
      // mes conversations, la plus récente d'abord
      const conversations = allMockConversations()
        .filter((record) => record.userId === account.user.id)
        .map((record) => record.conversation)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      return respond({ conversations, total: conversations.length });
    });
  }
  const match = path.match(/^\/agent\/conversations\/(\d+)$/);
  if (match && (req.method === 'GET' || req.method === 'DELETE')) {
    return withAccount(req, (account) => {
      const records = allMockConversations();
      const record = records.find(
        (item) => item.conversation.id === Number(match[1]) && item.userId === account.user.id,
      );
      if (!record) {
        // inexistante, ou à un autre utilisateur
        return fail(req, 404, {
          error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' },
        });
      }
      if (req.method === 'DELETE') {
        saveMockConversations(records.filter((item) => item !== record));
        return respond(null, 300, 204); // 204 : pas de contenu
      }
      return respond({ conversation: record.conversation, messages: record.messages });
    });
  }
  return null; // l'envoi d'un message ne passe pas ici : flux lu par AgentService
}
