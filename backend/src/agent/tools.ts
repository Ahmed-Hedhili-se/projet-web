import { z } from 'zod';
import { githubSource, parseRepoUrl, RepoError, RepoSource } from '../lib/github';
import { prisma } from '../lib/prisma';
import { toPrice } from '../utils/serializers';
import { ToolDefinition } from './llm';
import { missingFields, PartialProfile, workloadProfileSchema } from './profile';
import { RankResult, rankConfigs, Verdict } from './rankConfigs';
import { analyzeRepo, Fact, readRepoFile } from './repoAnalyzer';

export interface AgentState {
  repoUrl: string | null;
  profile: PartialProfile;
  facts: Fact[];
  lastRanking: RankResult | null;
}

export interface Step {
  tool: string;
  label: string;
}

export interface ConfigCardItem {
  rank: number;
  verdict: Verdict;
  gpu: { id: number; name: string; manufacturer: string; architecture: string; vramGb: number; pricePerHour: number };
  gpuCount: number;
  pricePerHour: number;
  availableUnits: number;
  estimate: RankResult['items'][number]['estimate'];
  reasons: string[];
  warnings: string[];
  rentPath: string;
}

export type Card =
  | { type: 'profile'; profile: PartialProfile; facts: Fact[]; missing: string[]; repoUrl: string | null }
  | { type: 'configs'; items: ConfigCardItem[] }
  | { type: 'replies'; options: string[] };

export interface ToolContext {
  state: AgentState;
  cards: Card[];
  onStep: (step: Step) => void;
  onCard: (card: Card) => void;
}

let repoSource: RepoSource = githubSource;
export function setRepoSource(source: RepoSource): void {
  repoSource = source;
}

const PROFILE_PROPERTIES = {
  mode: { type: 'string', enum: ['PRETRAINING', 'FULL_FINETUNE', 'LORA', 'QLORA', 'INFERENCE'] },
  paramsBillions: { type: 'number', description: 'Model size in billions of parameters' },
  activeParamsBillions: { type: 'number', description: 'MoE only: active parameters per token, in billions' },
  precision: { type: 'string', enum: ['FP32', 'BF16', 'FP16', 'FP8', 'INT8', 'INT4'] },
  layers: { type: 'integer' }, hiddenSize: { type: 'integer' }, kvHeads: { type: 'integer' }, headDim: { type: 'integer' },
  contextLength: { type: 'integer', description: 'Tokens per sequence' },
  batchSize: { type: 'integer', description: 'Sequences processed together (per GPU for training)' },
  trainingTokens: { type: 'number', description: 'Training tokens per epoch (dataset size in tokens)' },
  epochs: { type: 'number' },
  gradientCheckpointing: { type: 'boolean' },
  sharded: { type: 'boolean', description: 'ZeRO-3 / FSDP: weights and optimizer states split across GPUs' },
  usesCudaKernels: { type: 'boolean', description: 'Custom CUDA kernels, bitsandbytes, TensorRT-LLM, xformers...' },
  flashAttention: { type: 'string', enum: ['NONE', 'FA2', 'FA3'] },
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { type: 'function', function: {
    name: 'analyze_repo',
    description: 'Read a public GitHub repository of an AI model and extract facts (size, precision, LoRA/QLoRA, FlashAttention, DeepSpeed...) with evidence. Fills the workload profile.',
    parameters: { type: 'object', properties: { repoUrl: { type: 'string' } }, required: ['repoUrl'] },
  } },
  { type: 'function', function: {
    name: 'read_repo_file',
    description: 'Read the first 4000 characters of one file of the analyzed repository, when a fact is unclear.',
    parameters: { type: 'object', properties: { repoUrl: { type: 'string' }, path: { type: 'string' } }, required: ['repoUrl', 'path'] },
  } },
  { type: 'function', function: {
    name: 'update_workload_profile',
    description: 'Save or correct facts about the workload, from what the user said. Only send the fields that change.',
    parameters: { type: 'object', properties: { fields: { type: 'object', properties: PROFILE_PROPERTIES, additionalProperties: false } }, required: ['fields'] },
  } },
  { type: 'function', function: {
    name: 'rank_configs',
    description: 'Simulate every TeraMind GPU configuration (1, 2, 4 or 8 GPUs) for the current profile and rank them. Prices and stock come from the database.',
    parameters: { type: 'object', properties: {
      objective: { type: 'string', enum: ['lowest_cost', 'fastest', 'best_balance'] },
      startDate: { type: 'string', description: 'ISO date, only if the user gave a start date' },
      durationHours: { type: 'integer', description: 'Rental duration in hours, only if known' },
    }, required: ['objective'] },
  } },
  { type: 'function', function: {
    name: 'show_configs',
    description: 'Show cards with a "Rent this" button for configurations of the LAST ranking, by rank number.',
    parameters: { type: 'object', properties: { ranks: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 3 } }, required: ['ranks'] },
  } },
  { type: 'function', function: {
    name: 'suggest_replies',
    description: 'Show up to 4 quick-reply buttons (short English sentences the user can click).',
    parameters: { type: 'object', properties: { options: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 } }, required: ['options'] },
  } },
];

const argsSchemas = {
  analyze_repo: z.object({ repoUrl: z.string().min(1).max(300) }),
  read_repo_file: z.object({ repoUrl: z.string().min(1).max(300), path: z.string().min(1).max(300) }),
  update_workload_profile: z.object({ fields: workloadProfileSchema }),
  rank_configs: z.object({
    objective: z.enum(['lowest_cost', 'fastest', 'best_balance']),
    startDate: z.iso.datetime({ offset: true }).optional(),
    durationHours: z.number().int().min(1).max(720).optional(),
  }),
  show_configs: z.object({ ranks: z.array(z.number().int().positive()).min(1).max(3) }),
  suggest_replies: z.object({ options: z.array(z.string().trim().min(1).max(80)).min(1).max(4) }),
};

export type ToolName = keyof typeof argsSchemas;

const shortRepo = (url: string) => { const { owner, repo } = parseRepoUrl(url); return `github.com/${owner}/${repo}`; };

export async function executeTool(name: string, rawArgs: string, ctx: ToolContext): Promise<unknown> {
  if (!(name in argsSchemas)) return { error: `Unknown tool "${name}".` };
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawArgs || '{}');
  } catch {
    return { error: 'Arguments must be valid JSON.' };
  }
  const parsed = argsSchemas[name as ToolName].safeParse(parsedJson);
  if (!parsed.success) {
    return { error: 'Invalid arguments.', issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'args'}: ${i.message}`) };
  }

  try {
    switch (name as ToolName) {
      case 'analyze_repo': return await analyzeRepoTool(parsed.data as z.infer<typeof argsSchemas.analyze_repo>, ctx);
      case 'read_repo_file': {
        const args = parsed.data as z.infer<typeof argsSchemas.read_repo_file>;
        ctx.onStep({ tool: name, label: `Read ${args.path}` });
        return { untrustedRepositoryData: await readRepoFile(args.repoUrl, args.path, repoSource) };
      }
      case 'update_workload_profile': {
        const { fields } = parsed.data as z.infer<typeof argsSchemas.update_workload_profile>;
        ctx.state.profile = { ...ctx.state.profile, ...fields };
        ctx.onStep({ tool: name, label: `Updated the workload profile (${Object.keys(fields).join(', ')})` });
        return { profile: ctx.state.profile, missing: missingFields(ctx.state.profile) };
      }
      case 'rank_configs': return await rankTool(parsed.data as z.infer<typeof argsSchemas.rank_configs>, ctx);
      case 'show_configs': return await showConfigsTool((parsed.data as z.infer<typeof argsSchemas.show_configs>).ranks, ctx);
      case 'suggest_replies': {
        const { options } = parsed.data as z.infer<typeof argsSchemas.suggest_replies>;
        putCard(ctx, { type: 'replies', options });
        return { shown: options.length };
      }
    }
  } catch (err) {
    if (err instanceof RepoError) return { error: err.message };
    throw err;
  }
  return { error: 'Unhandled tool.' };
}

async function analyzeRepoTool({ repoUrl }: { repoUrl: string }, ctx: ToolContext) {
  ctx.onStep({ tool: 'analyze_repo', label: `Analyzing ${shortRepo(repoUrl)}` });
  const analysis = await analyzeRepo(repoUrl, repoSource);
  const sameRepo = ctx.state.repoUrl === repoUrl;
  ctx.state.profile = sameRepo
    ? { ...analysis.suggestedProfile, ...ctx.state.profile }
    : { ...ctx.state.profile, ...analysis.suggestedProfile };
  ctx.state.repoUrl = repoUrl;
  ctx.state.facts = analysis.facts;
  return {
    untrustedRepositoryData: {
      repo: analysis.repo, framework: analysis.framework, libraries: analysis.libraries,
      facts: analysis.facts, hardwareHints: analysis.hardwareHints, filesRead: analysis.filesRead,
    },
    profile: ctx.state.profile,
    missing: missingFields(ctx.state.profile).concat(
      ctx.state.profile.mode && ctx.state.profile.mode !== 'INFERENCE' && !ctx.state.profile.trainingTokens ? ['trainingTokens'] : []),
  };
}

async function rankTool(args: { objective: 'lowest_cost' | 'fastest' | 'best_balance'; startDate?: string; durationHours?: number }, ctx: ToolContext) {
  const result = await rankConfigs(ctx.state.profile, {
    objective: args.objective,
    startDate: args.startDate ? new Date(args.startDate) : undefined,
    durationHours: args.durationHours,
  });
  if ('error' in result) return result;
  ctx.state.lastRanking = result;
  ctx.onStep({ tool: 'rank_configs', label: `Simulated ${result.simulated} GPU configurations` });
  return result;
}

async function showConfigsTool(ranks: number[], ctx: ToolContext) {
  const ranking = ctx.state.lastRanking;
  if (!ranking) return { error: 'Call rank_configs first.' };
  const items = ranks.map((rank) => ranking.items.find((item) => item.rank === rank)).filter((item) => item !== undefined);
  if (items.length === 0) return { error: `No configuration with these ranks. Available ranks: ${ranking.items.map((i) => i.rank).join(', ') || 'none'}.` };

  const gpus = await prisma.gpu.findMany({ where: { id: { in: items.map((i) => i.gpuId) }, isActive: true } });
  const cardItems: ConfigCardItem[] = [];
  for (const item of items) {
    const gpu = gpus.find((g) => g.id === item.gpuId);
    if (!gpu) continue;
    const price = toPrice(gpu.pricePerHour);
    cardItems.push({
      rank: item.rank, verdict: item.verdict,
      gpu: { id: gpu.id, name: gpu.name, manufacturer: gpu.manufacturer, architecture: gpu.architecture, vramGb: gpu.vramGb, pricePerHour: price },
      gpuCount: item.gpuCount,
      pricePerHour: toPrice(price * item.gpuCount),
      availableUnits: item.availableUnits,
      estimate: item.estimate, reasons: item.reasons, warnings: item.warnings,
      rentPath: `/account/rentals/new?gpuId=${gpu.id}&quantity=${item.gpuCount}`,
    });
  }
  putCard(ctx, { type: 'configs', items: cardItems });
  return { shown: cardItems.map((i) => i.rank) };
}

function putCard(ctx: ToolContext, card: Card) {
  const index = ctx.cards.findIndex((c) => c.type === card.type);
  if (index >= 0) ctx.cards.splice(index, 1);
  ctx.cards.push(card);
  ctx.onCard(card);
}

export function profileCard(state: AgentState): Card {
  const missing = missingFields(state.profile);
  if (state.profile.mode && state.profile.mode !== 'INFERENCE' && !state.profile.trainingTokens) missing.push('trainingTokens');
  return { type: 'profile', profile: state.profile, facts: state.facts, missing, repoUrl: state.repoUrl };
}
