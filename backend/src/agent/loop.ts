import { getLlmProvider, LlmError, LlmMessage } from './llm';
import { SYSTEM_PROMPT, stateSummary } from './prompt';
import { AgentState, Card, executeTool, profileCard, Step, TOOL_DEFINITIONS } from './tools';

const MAX_TOOL_CALLS = 8;
const MAX_LLM_CALLS = 10;
const TURN_DEADLINE_MS = 120_000;
const HISTORY_MESSAGES = 8;
const HISTORY_CHARS = 1500;
const TOOL_RESULT_CHARS = 6000;

export interface TurnInput {
  history: { role: 'USER' | 'ASSISTANT'; content: string }[];
  userText: string;
  state: AgentState;
  onStep: (step: Step) => void;
  onCard: (card: Card) => void;
}

export interface TurnResult {
  content: string;
  steps: Step[];
  cards: Card[];
  state: AgentState;
  usage: { inputTokens: number; outputTokens: number };
}

export async function runAgentTurn(input: TurnInput): Promise<TurnResult> {
  const provider = getLlmProvider();
  const deadline = Date.now() + TURN_DEADLINE_MS;
  const state: AgentState = structuredClone(input.state);
  const profileBefore = JSON.stringify(state.profile);
  const steps: Step[] = [];
  const cards: Card[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const ctx = {
    state, cards,
    onStep: (step: Step) => { steps.push(step); input.onStep(step); },
    onCard: input.onCard,
  };

  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: stateSummary(state) },
    ...input.history.slice(-HISTORY_MESSAGES).map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content.slice(0, HISTORY_CHARS),
    })),
    { role: 'user', content: input.userText },
  ];

  let toolCalls = 0;
  let content: string | null = null;
  for (let call = 0; call < MAX_LLM_CALLS && content === null; call++) {
    if (Date.now() > deadline) throw new LlmError('The analysis took too long. Please try again with a simpler question.');
    const reply = await provider.complete(messages, TOOL_DEFINITIONS);
    usage.inputTokens += reply.usage.inputTokens;
    usage.outputTokens += reply.usage.outputTokens;

    if (reply.toolCalls.length === 0) {
      content = reply.content ?? '';
      break;
    }
    messages.push({
      role: 'assistant',
      content: reply.content,
      tool_calls: reply.toolCalls.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: t.arguments } })),
    });
    for (const toolCall of reply.toolCalls) {
      toolCalls += 1;
      const result = toolCalls > MAX_TOOL_CALLS
        ? { error: 'Tool limit reached for this message: answer the user now with what you know.' }
        : await executeTool(toolCall.name, toolCall.arguments, ctx);
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result).slice(0, TOOL_RESULT_CHARS) });
    }
  }
  if (content === null || content.trim() === '') {
    content = 'I could not finish the analysis for this message. Please rephrase or give me more details about your model.';
  }

  if (JSON.stringify(state.profile) !== profileBefore) {
    const card = profileCard(state);
    cards.unshift(card);
    input.onCard(card);
  }
  return { content, steps, cards, state, usage };
}
