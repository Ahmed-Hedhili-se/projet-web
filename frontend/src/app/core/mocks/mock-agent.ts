import {
  AgentCard,
  AgentConversation,
  AgentError,
  AgentEvent,
  AgentMessage,
  AgentPrecision,
  AgentStep,
  AgentWorkloadMode,
  ConfigItem,
  ProfileFact,
  Verdict,
  WorkloadProfile,
} from '../models/agent';
import { Gpu } from '../models/gpu';
import { allMockGpus } from './mock-gpus';

export interface MockConversationRecord {
  userId: number;
  conversation: AgentConversation;
  messages: AgentMessage[];
  profile: WorkloadProfile;
  facts: ProfileFact[];
}

export interface MockReply {
  steps: AgentStep[];
  cards: AgentCard[];
  text: string;
}

const AGENT_KEY = 'teramind_mock_agent';
export const MOCK_AGENT_DAILY_LIMIT = 30;
export const MOCK_AGENT_MODEL = 'demo (simulated answers)';
const STEP_DELAY_MS = navigator.userAgent.includes('jsdom') ? 0 : 900;
let memoryRecords: MockConversationRecord[] | null = null;

export function allMockConversations(): MockConversationRecord[] {
  try {
    const json = localStorage.getItem(AGENT_KEY);
    return json ? (JSON.parse(json) as MockConversationRecord[]) : [];
  } catch {
    return memoryRecords ?? [];
  }
}

export function saveMockConversations(records: MockConversationRecord[]): void {
  memoryRecords = records;
  try {
    localStorage.setItem(AGENT_KEY, JSON.stringify(records));
  } catch {
    return;
  }
}

export function createMockConversation(userId: number): AgentConversation {
  const records = allMockConversations();
  const now = new Date().toISOString();
  const conversation: AgentConversation = {
    id: Math.max(0, ...records.map((record) => record.conversation.id)) + 1,
    title: 'New conversation',
    repoUrl: null,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  saveMockConversations([
    ...records,
    { userId, conversation, messages: [], profile: {}, facts: [] },
  ]);
  return conversation;
}

export function mockMessagesUsedToday(userId: number): number {
  const today = new Date().toDateString();
  return allMockConversations()
    .filter((record) => record.userId === userId)
    .flatMap((record) => record.messages)
    .filter(
      (message) => message.role === 'USER' && new Date(message.createdAt).toDateString() === today,
    ).length;
}

const REPO_PATTERN = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i;
const TRAINING_MODES: AgentWorkloadMode[] = ['PRETRAINING', 'FULL_FINETUNE', 'LORA', 'QLORA'];

function detectMode(text: string): AgentWorkloadMode | undefined {
  if (/qlora/i.test(text)) return 'QLORA';
  if (/\blora\b/i.test(text)) return 'LORA';
  if (/pre-?train/i.test(text)) return 'PRETRAINING';
  if (/fine-?tun|\btrain/i.test(text)) return 'FULL_FINETUNE';
  if (/serv|inference|deploy|chatbot|concurrent|\busers\b/i.test(text)) return 'INFERENCE';
  return undefined;
}

function detectSize(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s?b\b(?!\s*tokens)/i);
  return match ? Number(match[1]) : undefined;
}

function detectTokens(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s?(k|m|b|million|billion)\s*tokens/i);
  if (!match) return undefined;
  const unit = match[2].toLowerCase();
  return Number(match[1]) * (unit === 'k' ? 1e3 : unit === 'm' || unit === 'million' ? 1e6 : 1e9);
}

function detectPrecision(text: string): AgentPrecision | undefined {
  const match = text.match(/\b(fp32|bf16|fp16|fp8|int8|int4)\b/i);
  if (match) return match[1].toUpperCase() as AgentPrecision;
  if (/\b4-?bit/i.test(text)) return 'INT4';
  if (/\b8-?bit/i.test(text)) return 'INT8';
  return undefined;
}

function analyzeMockRepo(record: MockConversationRecord, owner: string, repo: string): void {
  const name = `${owner}/${repo}`;
  const mode = detectMode(name) ?? 'QLORA';
  const script = mode === 'INFERENCE' ? 'serve.py' : 'train.py';
  const profile: WorkloadProfile = {
    mode,
    paramsBillions: detectSize(name) ?? 8,
    precision: mode === 'INFERENCE' ? 'FP16' : 'BF16',
    flashAttention: 'FA2',
    usesCudaKernels: true,
  };
  const facts: ProfileFact[] = [
    { field: 'mode', value: mode, evidence: script },
    { field: 'paramsBillions', value: profile.paramsBillions!, evidence: 'config.json' },
    { field: 'precision', value: profile.precision!, evidence: script },
    { field: 'flashAttention', value: 'FA2', evidence: 'requirements.txt' },
    { field: 'usesCudaKernels', value: true, evidence: 'requirements.txt' },
  ];
  if (mode !== 'INFERENCE') {
    profile.gradientCheckpointing = true;
    facts.push({ field: 'gradientCheckpointing', value: true, evidence: script });
  }
  record.conversation.repoUrl = `https://github.com/${name}`;
  record.profile = profile;
  record.facts = facts;
}

const BYTES_PER_PARAM: Record<AgentPrecision, number> = {
  FP32: 4,
  BF16: 2,
  FP16: 2,
  FP8: 1,
  INT8: 1,
  INT4: 0.5,
};
const GPU_EXTRAS: Record<
  number,
  { bandwidthGbs: number; fastInterconnect: boolean; ecc: boolean }
> = {
  1: { bandwidthGbs: 3350, fastInterconnect: true, ecc: true },
  2: { bandwidthGbs: 2039, fastInterconnect: true, ecc: true },
  3: { bandwidthGbs: 1555, fastInterconnect: false, ecc: true },
  4: { bandwidthGbs: 5300, fastInterconnect: true, ecc: true },
  5: { bandwidthGbs: 1008, fastInterconnect: false, ecc: false },
  6: { bandwidthGbs: 300, fastInterconnect: false, ecc: true },
};
const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

interface MockSimulation {
  gpu: Gpu;
  gpuCount: number;
  excluded: string | null;
  item: ConfigItem;
}

function memoryNeededGb(profile: WorkloadProfile): number {
  const params = profile.paramsBillions!;
  const bytes = BYTES_PER_PARAM[profile.precision!];
  switch (profile.mode) {
    case 'INFERENCE':
      return params * bytes * 1.2;
    case 'QLORA':
      return params * 0.8;
    case 'LORA':
      return params * bytes * 1.3;
    default:
      return params * bytes * 8 * 1.2;
  }
}

function simulate(profile: WorkloadProfile, gpu: Gpu, gpuCount: number): MockSimulation {
  const extras = GPU_EXTRAS[gpu.id] ?? {
    bandwidthGbs: gpu.vramGb * 25,
    fastInterconnect: false,
    ecc: true,
  };
  const training = TRAINING_MODES.includes(profile.mode!);
  const adapters = profile.mode === 'LORA' || profile.mode === 'QLORA';
  const memoryRequiredGb = round(memoryNeededGb(profile));
  const memoryPerGpuGb = round(adapters ? memoryRequiredGb : memoryRequiredGb / gpuCount);
  const pricePerHour = round(gpu.pricePerHour * gpuCount, 2);

  let excluded: string | null = null;
  if (profile.usesCudaKernels && gpu.manufacturer !== 'NVIDIA') {
    excluded = 'the code uses CUDA kernels, which do not run on AMD GPUs';
  } else if (memoryPerGpuGb > gpu.vramGb * 0.95) {
    excluded = `not enough memory (${memoryPerGpuGb} GB needed per GPU, ${gpu.vramGb} GB available)`;
  } else if (gpuCount > gpu.availableUnits) {
    excluded =
      gpu.availableUnits === 0
        ? 'no unit free right now'
        : `only ${gpu.availableUnits} unit(s) free right now`;
  }

  let hours: number | null = null;
  let tokensPerSecond: number | null = null;
  if (training) {
    const flopsPerParamToken = adapters ? 4 : 6;
    const efficiency = profile.mode === 'QLORA' ? 0.25 : 0.4;
    const scaling = gpuCount === 1 ? 1 : extras.fastInterconnect ? 0.9 : 0.7;
    const totalFlops =
      profile.trainingTokens! *
      (profile.epochs ?? 1) *
      profile.paramsBillions! *
      1e9 *
      flopsPerParamToken;
    hours = round(totalFlops / (gpu.fp16Tflops * 1e12 * efficiency * gpuCount * scaling) / 3600, 2);
  } else {
    const weightsGb = profile.paramsBillions! * BYTES_PER_PARAM[profile.precision!];
    tokensPerSecond = Math.max(1, Math.round((extras.bandwidthGbs * 0.6) / weightsGb));
  }

  const reasons = [
    `Fits in memory: ${memoryPerGpuGb} GB needed per GPU, ${gpu.vramGb} GB available.`,
  ];
  if (gpuCount > 1 && extras.fastInterconnect)
    reasons.push('GPUs are linked by a fast interconnect (NVLink / Infinity Fabric).');
  if (
    profile.precision === 'FP8' &&
    ['Hopper', 'Ada Lovelace', 'CDNA 3'].includes(gpu.architecture)
  )
    reasons.push('Native FP8 support on this architecture.');
  const warnings: string[] = [];
  if (memoryPerGpuGb > gpu.vramGb * 0.85)
    warnings.push('Memory is tight: little room for a larger batch or context.');
  if (gpuCount > 1 && !extras.fastInterconnect)
    warnings.push('GPUs communicate over PCIe: multi-GPU scaling is lower.');
  if (!extras.ecc) warnings.push('Consumer GPU without ECC memory.');

  return {
    gpu,
    gpuCount,
    excluded,
    item: {
      rank: 0,
      verdict: 'ALTERNATIVE',
      gpu: {
        id: gpu.id,
        name: gpu.name,
        manufacturer: gpu.manufacturer,
        architecture: gpu.architecture,
        vramGb: gpu.vramGb,
        pricePerHour: gpu.pricePerHour,
      },
      gpuCount,
      pricePerHour,
      availableUnits: gpu.availableUnits,
      estimate: {
        memoryRequiredGb,
        memoryPerGpuGb,
        hours,
        totalCost: hours === null ? null : round(hours * pricePerHour, 2),
        tokensPerSecond,
        costPerMillionTokens:
          tokensPerSecond === null
            ? null
            : round((pricePerHour / (tokensPerSecond * 3600)) * 1e6, 2),
      },
      reasons,
      warnings,
      rentPath: `/account/rentals/new?gpuId=${gpu.id}&quantity=${gpuCount}`,
    },
  };
}

function rankConfigs(profile: WorkloadProfile, objective: 'balance' | 'cost' | 'speed') {
  const sims = allMockGpus()
    .filter((gpu) => gpu.isActive)
    .flatMap((gpu) =>
      [1, 2, 4, 8]
        .filter((count) => count <= gpu.totalUnits)
        .map((count) => simulate(profile, gpu, count)),
    );
  const valid = sims.filter((sim) => sim.excluded === null);
  const cost = (sim: MockSimulation) =>
    sim.item.estimate.totalCost ?? sim.item.estimate.costPerMillionTokens!;
  const slowness = (sim: MockSimulation) =>
    sim.item.estimate.hours ?? 1 / sim.item.estimate.tokensPerSecond!;
  const minCost = Math.min(...valid.map(cost));
  const minSlowness = Math.min(...valid.map(slowness));
  const balance = (sim: MockSimulation) => cost(sim) / minCost + slowness(sim) / minSlowness;
  const by = (score: (sim: MockSimulation) => number) =>
    [...valid].sort((a, b) => score(a) - score(b) || a.gpuCount - b.gpuCount);

  const picked: [Verdict, MockSimulation][] = [];
  const add = (verdict: Verdict, sim: MockSimulation | undefined) => {
    if (sim && picked.length < 3 && !picked.some(([, other]) => other === sim))
      picked.push([verdict, sim]);
  };
  add(
    'BEST_CHOICE',
    by(objective === 'cost' ? cost : objective === 'speed' ? slowness : balance)[0],
  );
  add('CHEAPEST', by(cost)[0]);
  add('FASTEST', by(slowness)[0]);
  for (const sim of by(balance)) {
    if (!picked.some(([, other]) => other.gpu.id === sim.gpu.id)) add('ALTERNATIVE', sim);
  }
  const items = picked.map(([verdict, sim], index) => ({ ...sim.item, rank: index + 1, verdict }));

  const excluded = allMockGpus()
    .filter(
      (gpu) =>
        gpu.isActive &&
        sims.filter((sim) => sim.gpu.id === gpu.id).every((sim) => sim.excluded !== null),
    )
    .map((gpu) => `${gpu.name}: ${sims.filter((sim) => sim.gpu.id === gpu.id).at(-1)!.excluded}`);
  return { simulated: sims.length, items, excluded };
}

const MODE_LABELS: Record<AgentWorkloadMode, string> = {
  PRETRAINING: 'pre-training',
  FULL_FINETUNE: 'full fine-tuning',
  LORA: 'LoRA fine-tuning',
  QLORA: 'QLoRA fine-tuning',
  INFERENCE: 'inference',
};

function formatHours(hours: number): string {
  return hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${round(hours)} h`;
}

function describe(item: ConfigItem): string {
  const { hours, totalCost, tokensPerSecond, costPerMillionTokens } = item.estimate;
  return hours !== null
    ? `about **${formatHours(hours)}** for about **$${Math.round(totalCost!)}**`
    : `about **${tokensPerSecond} tokens/s**, or **$${costPerMillionTokens} per million tokens**`;
}

export function buildMockReply(record: MockConversationRecord, content: string): MockReply {
  const steps: AgentStep[] = [];
  const repo = content.match(REPO_PATTERN);
  const text = content.replace(REPO_PATTERN, ' ');
  if (repo) {
    const name = `${repo[1]}/${repo[2].replace(/\.git$/, '').replace(/\.+$/, '')}`;
    if (record.conversation.repoUrl !== `https://github.com/${name}`) {
      const [owner, repoName] = name.split('/');
      analyzeMockRepo(record, owner, repoName);
      steps.push({ tool: 'analyze_repo', label: `Analyzing github.com/${name}` });
    }
  }

  const profile = record.profile;
  const told: string[] = [];
  const mode = detectMode(text);
  const size = detectSize(text);
  const tokens = detectTokens(text);
  const precision = detectPrecision(text);
  if (mode) {
    profile.mode = mode;
    told.push('mode');
  }
  if (size) {
    profile.paramsBillions = size;
    told.push('paramsBillions');
  }
  if (tokens) {
    profile.trainingTokens = tokens;
    told.push('trainingTokens');
  }
  if (precision) {
    profile.precision = precision;
    told.push('precision');
  }
  if (told.length > 0)
    steps.push({
      tool: 'update_workload_profile',
      label: `Updated the workload profile (${told.join(', ')})`,
    });

  const assumptions: string[] = [];
  if (profile.mode && !profile.precision) {
    profile.precision = profile.mode === 'INFERENCE' ? 'FP16' : 'BF16';
    assumptions.push(`I assumed ${profile.precision} precision.`);
  }

  const missing = (['mode', 'paramsBillions', 'precision'] as const).filter(
    (field) => profile[field] === undefined,
  ) as string[];
  if (profile.mode && TRAINING_MODES.includes(profile.mode) && profile.trainingTokens === undefined)
    missing.push('trainingTokens');
  const cards: AgentCard[] = [];
  if (Object.keys(profile).length > 0) {
    cards.push({
      type: 'profile',
      repoUrl: record.conversation.repoUrl,
      profile: { ...profile },
      facts: [...record.facts],
      missing: [...missing],
    });
  }

  if (missing.includes('mode')) {
    cards.push({
      type: 'replies',
      options: ['Fine-tune with QLoRA', 'Full fine-tuning', 'Serve it (inference)'],
    });
    return {
      steps,
      cards,
      text: 'I can recommend a GPU configuration for your model.\n\n**What do you want to do with it?** You can also paste the link of its GitHub repository and I will read it.',
    };
  }
  if (missing.includes('paramsBillions')) {
    cards.push({ type: 'replies', options: ['7B model', '13B model', '70B model'] });
    return {
      steps,
      cards,
      text: `Got it: **${MODE_LABELS[profile.mode!]}**.\n\n**How big is the model?** Give its number of parameters, for example "8B".`,
    };
  }
  if (missing.includes('trainingTokens')) {
    cards.push({ type: 'replies', options: ['50M tokens', '300M tokens', '1B tokens'] });
    const source = record.conversation.repoUrl
      ? 'The repository does not say how much data you train on.'
      : 'One thing is missing to estimate the training time.';
    return {
      steps,
      cards,
      text: `${source}\n\n**How many tokens does your dataset contain?** One token is about three quarters of a word.`,
    };
  }

  const objective = /cheap|lowest|budget/i.test(text)
    ? 'cost'
    : /fast|quick|speed/i.test(text)
      ? 'speed'
      : 'balance';
  const ranking = rankConfigs(profile, objective);
  steps.push({ tool: 'rank_configs', label: `Simulated ${ranking.simulated} GPU configurations` });
  const summary = `a **${profile.paramsBillions}B** model, **${MODE_LABELS[profile.mode!]}**, in **${profile.precision}**`;
  const subject = record.conversation.repoUrl
    ? `Your repository **${record.conversation.repoUrl.replace('https://github.com/', '')}** runs ${summary}.`
    : `Your workload: ${summary}.`;

  if (ranking.items.length === 0) {
    cards.push({
      type: 'replies',
      options: ['What if I use QLoRA?', 'What if I use INT4?', 'Serve it (inference)'],
    });
    return {
      steps,
      cards,
      text: `${subject}\n\n**No configuration in our catalog fits this workload**, even with 8 GPUs. It needs about ${round(memoryNeededGb(profile))} GB of memory. A lighter method or a lower precision would fit.`,
    };
  }

  cards.push({ type: 'configs', items: ranking.items });
  cards.push({
    type: 'replies',
    options: [
      'Cheapest option',
      'Fastest option',
      profile.precision === 'FP8' ? 'What if I use BF16?' : 'What if I use FP8?',
    ],
  });
  const best = ranking.items[0];
  const verdictLabels: Record<Verdict, string> = {
    BEST_CHOICE: 'Best choice',
    CHEAPEST: 'Cheapest',
    FASTEST: 'Fastest',
    ALTERNATIVE: 'Alternative',
  };
  const others = ranking.items
    .slice(1)
    .map(
      (item) =>
        `- **${verdictLabels[item.verdict]}**: ${item.gpuCount} × ${item.gpu.name}, ${describe(item)}.`,
    );
  const paragraphs = [
    subject,
    `Best architecture: **${best.gpu.architecture}**. **${best.gpuCount} × ${best.gpu.name}** would take ${describe(best)}.`,
  ];
  if (others.length > 0) paragraphs.push(others.join('\n'));
  if (ranking.excluded.length > 0) paragraphs.push(`Excluded: ${ranking.excluded.join('; ')}.`);
  paragraphs.push([...assumptions, 'Estimates are approximate (±30%).'].join(' '));
  return { steps, cards, text: paragraphs.join('\n\n') };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function replayMockAgent(
  userId: number,
  conversationId: number,
  content: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const records = allMockConversations();
  const record = records.find(
    (item) => item.conversation.id === conversationId && item.userId === userId,
  );
  const text = content.trim();
  if (!record) {
    throw {
      code: 'CONVERSATION_NOT_FOUND',
      message: 'Conversation not found.',
    } satisfies AgentError;
  }
  if (text.length < 1 || text.length > 4000) {
    throw {
      code: 'VALIDATION_ERROR',
      message: 'Your message must be between 1 and 4000 characters.',
    } satisfies AgentError;
  }
  if (mockMessagesUsedToday(userId) >= MOCK_AGENT_DAILY_LIMIT) {
    throw {
      code: 'AGENT_DAILY_LIMIT',
      message: `You have reached the limit of ${MOCK_AGENT_DAILY_LIMIT} messages per day. Try again tomorrow.`,
    } satisfies AgentError;
  }

  const nextId = () =>
    Math.max(0, ...records.flatMap((item) => item.messages.map((message) => message.id))) + 1;
  const userMessage: AgentMessage = {
    id: nextId(),
    role: 'USER',
    content: text,
    steps: [],
    cards: [],
    createdAt: new Date().toISOString(),
  };
  record.messages.push(userMessage);
  if (record.conversation.title === 'New conversation') {
    record.conversation.title = text.length > 60 ? `${text.slice(0, 57)}...` : text;
  }
  record.conversation.messageCount = record.messages.length;
  record.conversation.updatedAt = userMessage.createdAt;
  saveMockConversations(records);
  onEvent({ event: 'user_message', data: { message: userMessage } });

  const reply = buildMockReply(record, text);
  for (const step of reply.steps) {
    await wait(STEP_DELAY_MS);
    if (signal?.aborted) return;
    onEvent({ event: 'step', data: step });
  }
  await wait(STEP_DELAY_MS);
  if (signal?.aborted) return;
  for (const card of reply.cards) {
    onEvent({ event: 'card', data: { card } });
  }
  onEvent({ event: 'text', data: { delta: reply.text } });

  const message: AgentMessage = {
    id: nextId(),
    role: 'ASSISTANT',
    content: reply.text,
    steps: reply.steps,
    cards: reply.cards,
    createdAt: new Date().toISOString(),
  };
  record.messages.push(message);
  record.conversation.messageCount = record.messages.length;
  record.conversation.updatedAt = message.createdAt;
  saveMockConversations(records);
  onEvent({ event: 'done', data: { message, conversation: { ...record.conversation } } });
}
