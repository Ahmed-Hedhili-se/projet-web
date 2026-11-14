// Boucle d'un tour de conversation : le LLM appelle des outils, le backend les exécute, jusqu'à la réponse finale.
import { getLlmProvider, LlmError, LlmMessage } from './llm';
import { SYSTEM_PROMPT, stateSummary } from './prompt';
import { AgentState, Card, executeTool, profileCard, Step, TOOL_DEFINITIONS } from './tools';

const MAX_TOOL_CALLS = 8;                                   // outils exécutés au maximum par message utilisateur
const MAX_LLM_CALLS = 10;                                   // appels au modèle au maximum par message
const TURN_DEADLINE_MS = 120_000;                           // un tour ne dépasse jamais 2 minutes
const HISTORY_MESSAGES = 8;                                 // derniers messages renvoyés au modèle (limite de 8 000 tokens)
const HISTORY_CHARS = 1500;                                 // chaque ancien message est tronqué
const TOOL_RESULT_CHARS = 6000;                             // résultat d'outil tronqué avant d'être renvoyé au modèle

export interface TurnInput {
  history: { role: 'USER' | 'ASSISTANT'; content: string }[]; // messages précédents (du plus ancien au plus récent)
  userText: string;
  state: AgentState;
  onStep: (step: Step) => void;
  onCard: (card: Card) => void;
}

export interface TurnResult {
  content: string;                                          // réponse finale en Markdown
  steps: Step[];
  cards: Card[];
  state: AgentState;
  usage: { inputTokens: number; outputTokens: number };
}

export async function runAgentTurn(input: TurnInput): Promise<TurnResult> {
  const provider = getLlmProvider();
  const deadline = Date.now() + TURN_DEADLINE_MS;
  const state: AgentState = structuredClone(input.state);   // copie : la base n'est mise à jour qu'en cas de succès
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
    { role: 'system', content: stateSummary(state) },       // mémoire de la conversation, compacte
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
    for (const toolCall of reply.toolCalls) {               // chaque appel reçoit une réponse, même refusée (exigé par l'API)
      toolCalls += 1;
      const result = toolCalls > MAX_TOOL_CALLS
        ? { error: 'Tool limit reached for this message: answer the user now with what you know.' }
        : await executeTool(toolCall.name, toolCall.arguments, ctx);
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result).slice(0, TOOL_RESULT_CHARS) });
    }
  }
  if (content === null || content.trim() === '') {          // le modèle n'a pas conclu : message honnête plutôt que rien
    content = 'I could not finish the analysis for this message. Please rephrase or give me more details about your model.';
  }

  if (JSON.stringify(state.profile) !== profileBefore) {    // le profil a changé : on montre ce que l'IA a compris
    const card = profileCard(state);
    cards.unshift(card);
    input.onCard(card);
  }
  return { content, steps, cards, state, usage };
}
