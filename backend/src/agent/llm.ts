import { env } from '../config/env';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface LlmReply {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly model: string;
  isConfigured(): boolean;
  complete(messages: LlmMessage[], tools: ToolDefinition[]): Promise<LlmReply>;
}

export class LlmError extends Error {}

const TIMEOUT_MS = 60_000;

const apiKey = () => env.LLM_API_KEY || env.GITHUB_TOKEN;

export const openAiCompatibleProvider: LlmProvider = {
  model: env.LLM_MODEL,
  isConfigured: () => apiKey() !== '',

  async complete(messages, tools) {
    let res: Response;
    try {
      res = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ model: env.LLM_MODEL, messages, tools, tool_choice: 'auto', temperature: 0.2 }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new LlmError('The AI service did not answer in time. Please try again.');
    }
    if (res.status === 429) throw new LlmError('The AI service is busy (rate limit reached). Please try again in a minute.');
    if (res.status === 401 || res.status === 403) throw new LlmError('The AI service rejected the API key. Check GITHUB_TOKEN / LLM_API_KEY.');
    if (res.status === 413) throw new LlmError('The conversation is too long for the AI service. Start a new conversation.');
    if (!res.ok) throw new LlmError(`The AI service returned an error (${res.status}).`);

    const text = await res.text();
    let data: {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      data = JSON.parse(text);
    } catch {
      throw new LlmError('The AI service returned an unexpected answer. Check LLM_BASE_URL and the API key.');
    }
    const message = data.choices?.[0]?.message;
    if (!message) throw new LlmError('The AI service returned an empty answer.');
    return {
      content: message.content ?? null,
      toolCalls: (message.tool_calls ?? []).map((call) => ({ id: call.id, name: call.function.name, arguments: call.function.arguments })),
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
    };
  },
};

let current: LlmProvider = openAiCompatibleProvider;

export function getLlmProvider(): LlmProvider {
  return current;
}

export function setLlmProvider(provider: LlmProvider): void {
  current = provider;
}
