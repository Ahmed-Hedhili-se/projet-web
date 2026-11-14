import type { LlmMessage, LlmProvider, LlmReply, ToolCall } from './llm';
import { missingFields, type PartialProfile } from './profile';
import type { RankResult } from './rankConfigs';

let counter = 0;
const call = (name: string, args: unknown): ToolCall => ({ id: `demo_${++counter}`, name, arguments: JSON.stringify(args) });
const tools = (...calls: ToolCall[]): LlmReply => ({ content: null, toolCalls: calls, usage: { inputTokens: 0, outputTokens: 0 } });
const text = (content: string): LlmReply => ({ content, toolCalls: [], usage: { inputTokens: 0, outputTokens: 0 } });

const NOTE = '\n\n_Demo mode: rule-based advisor, no AI model. Figures come from the real TeraMind simulator._';

export function profileFromText(input: string): PartialProfile {
  const t = input.toLowerCase();
  const profile: PartialProfile = {};
  const withoutUrls = t.replace(/https?:\/\/\S+/g, ' ');
  const size = withoutUrls.match(/(\d+(?:\.\d+)?)\s?b\b(?!\s*tokens)/);
  if (size) profile.paramsBillions = Number(size[1]);
  if (/\bqlora\b|4.?bit/.test(t)) profile.mode = 'QLORA';
  else if (/\blora\b/.test(t)) profile.mode = 'LORA';
  else if (/pre-?train/.test(t)) profile.mode = 'PRETRAINING';
  else if (/fine-?tun|\btrain/.test(t)) profile.mode = 'FULL_FINETUNE';
  else if (/infer|serv|deploy|chatbot|generat/.test(t)) profile.mode = 'INFERENCE';
  const precision = t.match(/\b(fp8|bf16|fp16|fp32|int8|int4)\b/);
  if (precision) profile.precision = precision[1].toUpperCase() as PartialProfile['precision'];
  const tokens = t.match(/(\d+(?:\.\d+)?)\s?(k|m|b|t)\s*tokens/);
  if (tokens) profile.trainingTokens = Number(tokens[1]) * { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[tokens[2] as 'k' | 'm' | 'b' | 't'];
  return profile;
}

function missingOf(profile: PartialProfile): string[] {
  const missing = missingFields(profile);
  if (profile.mode && profile.mode !== 'INFERENCE' && !profile.trainingTokens) missing.push('trainingTokens');
  return missing;
}

function objectiveFrom(input: string): 'lowest_cost' | 'fastest' | 'best_balance' {
  const t = input.toLowerCase();
  return /cheap|lowest cost|budget/.test(t) ? 'lowest_cost' : /fast|quick/.test(t) ? 'fastest' : 'best_balance';
}

function turnContext(messages: LlmMessage[]) {
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  const userText = (messages[lastUser] as { content: string }).content;
  const names = new Map<string, string>();
  const results = new Map<string, any>();
  for (const m of messages.slice(lastUser + 1)) {
    if (m.role === 'assistant') m.tool_calls?.forEach((c) => names.set(c.id, c.function.name));
    if (m.role === 'tool') results.set(names.get(m.tool_call_id) ?? '', JSON.parse(m.content));
  }
  const stateMessage = messages.find((m) => m.role === 'system' && m.content.startsWith('Conversation state'));
  const state = stateMessage ? JSON.parse((stateMessage as { content: string }).content.replace(/^[^{]*/, '')) : {};
  return { userText, results, profile: (state.workloadProfile ?? {}) as PartialProfile, hasRanking: Boolean(state.lastRankingAvailable) };
}

const QUESTIONS: Record<string, { question: string; options: string[] }> = {
  mode: { question: 'Do you want to **train** this model or to **serve** it (inference)?', options: ['Inference', 'LoRA fine-tuning', 'QLoRA fine-tuning', 'Full fine-tuning'] },
  paramsBillions: { question: 'How big is the model, in billions of parameters?', options: ['7B model', '13B model', '70B model'] },
  precision: { question: 'Which precision will you use?', options: ['BF16', 'FP16', 'FP8', 'INT4'] },
  trainingTokens: { question: 'How many tokens is your training dataset?', options: ['100M tokens', '1B tokens', '10B tokens'] },
};

function summarize(ranking: RankResult): string {
  const [best] = ranking.items;
  if (!best) {
    const reason = ranking.excluded[0]?.reason ?? 'no configuration fits';
    return `None of our GPU configurations can run this workload (${reason}). Try QLoRA, a smaller model or a lower precision.${NOTE}`;
  }
  const estimate = (item: RankResult['items'][number]) => item.estimate.hours !== null
    ? `about **${item.estimate.hours} h** for about **$${item.estimate.totalCost}**`
    : item.estimate.tokensPerSecond !== null
      ? `about **${item.estimate.tokensPerSecond} tokens/s** ($${item.estimate.costPerMillionTokens} per million tokens)`
      : `$${item.pricePerHour}/hour`;
  const lines = [
    `Best architecture: **${best.architecture}**. ${best.gpuCount} × ${best.gpuName} would take ${estimate(best)}.`,
    '',
    ...ranking.items.slice(1, 3).map((item) => `- **${item.verdict === 'CHEAPEST' ? 'Cheapest' : item.verdict === 'FASTEST' ? 'Fastest' : 'Alternative'}**: ${item.gpuCount} × ${item.gpuName} (${item.architecture}), ${estimate(item)}.`),
  ];
  if (ranking.excluded.length) lines.push('', `Excluded: ${ranking.excluded.map((e) => `${e.gpu} (${e.reason.replace(/\.$/, '')})`).join('; ')}.`);
  if (best.warnings.length) lines.push('', `⚠️ ${best.warnings[0]}`);
  lines.push('', 'Estimates are approximate (±30%).');
  return lines.join('\n') + NOTE;
}

export const demoProvider: LlmProvider = {
  model: 'demo/rule-based',
  isConfigured: () => true,

  async complete(messages) {
    const { userText, results, profile, hasRanking } = turnContext(messages);

    if (results.has('show_configs')) return text(summarize(results.get('rank_configs') as RankResult));
    const ranked = results.get('rank_configs');
    if (ranked && !ranked.error) {
      return tools(
        call('show_configs', { ranks: (ranked as RankResult).items.slice(0, 3).map((i) => i.rank) }),
        call('suggest_replies', { options: ['Cheapest option', 'Fastest option', 'What if I use FP8?'] }),
      );
    }
    const latest: PartialProfile | undefined =
      results.get('update_workload_profile')?.profile ?? results.get('analyze_repo')?.profile;
    const missing = ranked?.missing ?? (latest ? missingOf(latest) : []);
    const ask = missing.length ? QUESTIONS[missing[0]] ?? QUESTIONS.mode : null;
    if (results.has('suggest_replies')) {
      return text(`${ask?.question ?? 'Tell me about your workload: paste your GitHub repository, or describe the model, its size and what you want to do with it.'}${NOTE}`);
    }
    if (ask) return tools(call('suggest_replies', { options: ask.options }));
    if (results.has('analyze_repo') || results.has('update_workload_profile')) {
      const error = results.get('analyze_repo')?.error;
      if (error) return text(`I could not read this repository: ${error}${NOTE}`);
      return tools(call('rank_configs', { objective: objectiveFrom(userText) }));
    }

    const repo = userText.match(/https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+/i)?.[0];
    const fields = profileFromText(userText);
    if (!repo && fields.mode && !fields.precision && !profile.precision) fields.precision = 'BF16';
    const calls: ToolCall[] = [];
    if (repo) calls.push(call('analyze_repo', { repoUrl: repo }));
    if (Object.keys(fields).length) calls.push(call('update_workload_profile', { fields }));
    if (calls.length) return tools(...calls);
    if (hasRanking || profile.mode) return tools(call('rank_configs', { objective: objectiveFrom(userText) }));
    return tools(call('suggest_replies', { options: ['Serve a 7B model', 'QLoRA fine-tuning of an 8B model', 'Analyze my GitHub repo'] }));
  },
};
