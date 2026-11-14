import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AgentConversation, AgentEvent, AgentStatus, ConfigsCard, ProfileCard, RepliesCard } from '../models/agent';
import { MockConversationRecord, allMockConversations, buildMockReply, createMockConversation, replayMockAgent } from './mock-agent';
import { mockApiInterceptor } from './mock-api-interceptor';

describe('mock AI advisor', () => {
  const newRecord = (): MockConversationRecord => ({
    userId: 3, messages: [], profile: {}, facts: [],
    conversation: { id: 1, title: 'New conversation', repoUrl: null, messageCount: 0, createdAt: '', updatedAt: '' },
  });

  beforeEach(() => localStorage.clear());

  it('should rank configurations with the same formulas as the backend simulator', () => {
    const reply = buildMockReply(newRecord(), 'Fine-tune Llama 3.1 8B with QLoRA on 300M tokens');
    const configs = reply.cards.find((card): card is ConfigsCard => card.type === 'configs')!;
    const best = configs.items[0];
    const cheapest = configs.items.find((item) => item.verdict === 'CHEAPEST')!;

    expect(best.verdict).toBe('BEST_CHOICE');
    expect(`${best.gpuCount} x ${best.gpu.name}`).toBe('4 x NVIDIA H100 80GB');
    expect(best.rentPath).toBe('/account/rentals/new?gpuId=1&quantity=4');
    expect(cheapest.gpuCount).toBe(1);
    expect(cheapest.estimate.hours).toBe(10.78);
    expect(cheapest.estimate.totalCost).toBe(34.5);
    expect(cheapest.estimate.memoryPerGpuGb).toBe(6.4);
    expect(reply.text).toContain('Best architecture: **Hopper**');
    expect(configs.items.some((item) => item.gpu.manufacturer === 'AMD')).toBe(false);
  });

  it('should read a repository, then ask for the dataset size before simulating', () => {
    const record = newRecord();
    const first = buildMockReply(record, 'Repository: https://github.com/artidoro/qlora\n\nWhich GPU should I rent?');
    const profile = first.cards.find((card): card is ProfileCard => card.type === 'profile')!;

    expect(first.steps[0]).toEqual({ tool: 'analyze_repo', label: 'Analyzing github.com/artidoro/qlora' });
    expect(profile.profile.mode).toBe('QLORA');
    expect(profile.facts.some((fact) => fact.evidence === 'config.json')).toBe(true);
    expect(profile.missing).toEqual(['trainingTokens']);
    expect(first.cards.find((card): card is RepliesCard => card.type === 'replies')!.options).toContain('300M tokens');
    expect(first.cards.some((card) => card.type === 'configs')).toBe(false);

    const second = buildMockReply(record, '300M tokens');
    expect(second.cards.some((card) => card.type === 'configs')).toBe(true);
    expect(second.text).toContain('artidoro/qlora');
  });

  it('should exclude a model that does not fit in memory', () => {
    const reply = buildMockReply(newRecord(), 'Full fine-tuning of a 405B model on 1B tokens');
    expect(reply.cards.some((card) => card.type === 'configs')).toBe(false);
    expect(reply.text).toContain('No configuration in our catalog fits');
  });

  it('should replay the answer as a stream of events and save the conversation', async () => {
    const conversation = createMockConversation(3);
    const events: AgentEvent[] = [];
    await replayMockAgent(3, conversation.id, 'Serve Mistral 7B for 50 concurrent users', (event) => events.push(event));

    expect(events[0].event).toBe('user_message');
    expect(events.at(-1)?.event).toBe('done');
    expect(events.map((event) => event.event)).toContain('card');
    const record = allMockConversations()[0];
    expect(record.messages.map((message) => message.role)).toEqual(['USER', 'ASSISTANT']);
    expect(record.conversation.title).toBe('Serve Mistral 7B for 50 concurrent users');

    const error = await replayMockAgent(4, conversation.id, 'Hello', () => undefined).catch((err: unknown) => err);
    expect(error).toEqual({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' });
  });

  it('should serve the /agent routes of docs/API.md', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockApiInterceptor]))] });
    const http = TestBed.inject(HttpClient);
    const jane = { headers: { Authorization: 'Bearer mock-token-3' } };
    const url = `${environment.apiUrl}/agent`;

    const status = await firstValueFrom(http.get<AgentStatus>(`${url}/status`, jane));
    expect(status).toEqual({ available: true, model: 'demo (simulated answers)', dailyMessageLimit: 30, messagesUsedToday: 0 });

    const created = await firstValueFrom(http.post<{ conversation: AgentConversation }>(`${url}/conversations`, {}, jane));
    expect(created.conversation.title).toBe('New conversation');
    const list = await firstValueFrom(http.get<{ total: number }>(`${url}/conversations`, jane));
    expect(list.total).toBe(1);

    const other = { headers: { Authorization: 'Bearer mock-token-1' } };
    const error = (await firstValueFrom(http.get(`${url}/conversations/${created.conversation.id}`, other)).catch((err: unknown) => err)) as HttpErrorResponse;
    expect(error.error.error.code).toBe('CONVERSATION_NOT_FOUND');

    const deleted = await firstValueFrom(http.delete(`${url}/conversations/${created.conversation.id}`, { ...jane, observe: 'response' }));
    expect(deleted.status).toBe(204);
    expect(await firstValueFrom(http.get(`${url}/status`).pipe()).catch((err: HttpErrorResponse) => err.status)).toBe(401);
  });
});
