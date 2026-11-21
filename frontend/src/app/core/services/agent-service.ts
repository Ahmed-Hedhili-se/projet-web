import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { replayMockAgent } from '../mocks/mock-agent';
import {
  AgentConversation,
  AgentError,
  AgentEvent,
  AgentMessage,
  AgentStatus,
} from '../models/agent';
import { AuthService } from './auth-service';

export function parseSseBlock(block: string): AgentEvent | null {
  const event = block.match(/^event: (.+)$/m)?.[1];
  const data = block.match(/^data: (.+)$/m)?.[1];
  if (!event || !data) {
    return null;
  }
  try {
    return { event, data: JSON.parse(data) } as AgentEvent;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/agent`;

  status(): Observable<AgentStatus> {
    return this.http.get<AgentStatus>(`${this.baseUrl}/status`);
  }

  create(): Observable<{ conversation: AgentConversation }> {
    return this.http.post<{ conversation: AgentConversation }>(`${this.baseUrl}/conversations`, {});
  }

  list(): Observable<{ conversations: AgentConversation[]; total: number }> {
    return this.http.get<{ conversations: AgentConversation[]; total: number }>(
      `${this.baseUrl}/conversations`,
    );
  }

  get(id: number): Observable<{ conversation: AgentConversation; messages: AgentMessage[] }> {
    return this.http.get<{ conversation: AgentConversation; messages: AgentMessage[] }>(
      `${this.baseUrl}/conversations/${id}`,
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/conversations/${id}`);
  }

  async send(
    id: number,
    content: string,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    if (environment.useMockApi) {
      return replayMockAgent(this.auth.currentUser()?.id ?? 0, id, content, onEvent, signal);
    }
    const response = await fetch(`${this.baseUrl}/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.auth.token()}` },
      body: JSON.stringify({ content }),
      signal,
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) {
        this.auth.logout('/login');
      }
      const body = (await response.json().catch(() => null)) as { error?: AgentError } | null;
      throw (
        body?.error ??
        ({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } satisfies AgentError)
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf('\n\n');
      while (end >= 0) {
        const event = parseSseBlock(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (event) {
          onEvent(event);
        }
        end = buffer.indexOf('\n\n');
      }
    }
  }
}
