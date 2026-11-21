export type AgentRole = 'USER' | 'ASSISTANT';
export type Verdict = 'BEST_CHOICE' | 'CHEAPEST' | 'FASTEST' | 'ALTERNATIVE';
export type AgentWorkloadMode = 'PRETRAINING' | 'FULL_FINETUNE' | 'LORA' | 'QLORA' | 'INFERENCE';
export type AgentPrecision = 'FP32' | 'BF16' | 'FP16' | 'FP8' | 'INT8' | 'INT4';

export interface AgentStatus {
  available: boolean;
  model: string;
  dailyMessageLimit: number;
  messagesUsedToday: number;
}

export interface AgentConversation {
  id: number;
  title: string;
  repoUrl: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentStep {
  tool: string;
  label: string;
}

export interface ProfileFact {
  field: string;
  value: string | number | boolean;
  evidence: string;
}

export interface WorkloadProfile {
  mode?: AgentWorkloadMode;
  paramsBillions?: number;
  activeParamsBillions?: number;
  precision?: AgentPrecision;
  contextLength?: number;
  batchSize?: number;
  trainingTokens?: number;
  epochs?: number;
  gradientCheckpointing?: boolean;
  sharded?: boolean;
  usesCudaKernels?: boolean;
  flashAttention?: 'NONE' | 'FA2' | 'FA3';
}

export interface ProfileCard {
  type: 'profile';
  repoUrl: string | null;
  profile: WorkloadProfile;
  facts: ProfileFact[];
  missing: string[];
}

export interface ConfigItem {
  rank: number;
  verdict: Verdict;
  gpu: {
    id: number;
    name: string;
    manufacturer: string;
    architecture: string;
    vramGb: number;
    pricePerHour: number;
  };
  gpuCount: number;
  pricePerHour: number;
  availableUnits: number;
  estimate: {
    memoryRequiredGb: number;
    memoryPerGpuGb: number;
    hours: number | null;
    totalCost: number | null;
    tokensPerSecond: number | null;
    costPerMillionTokens: number | null;
  };
  reasons: string[];
  warnings: string[];
  rentPath: string;
}

export interface ConfigsCard {
  type: 'configs';
  items: ConfigItem[];
}

export interface RepliesCard {
  type: 'replies';
  options: string[];
}

export type AgentCard = ProfileCard | ConfigsCard | RepliesCard;

export interface AgentMessage {
  id: number;
  role: AgentRole;
  content: string;
  steps: AgentStep[];
  cards: AgentCard[];
  createdAt: string;
}

export interface AgentError {
  code: string;
  message: string;
}

export type AgentEvent =
  | { event: 'user_message'; data: { message: AgentMessage } }
  | { event: 'step'; data: AgentStep }
  | { event: 'card'; data: { card: AgentCard } }
  | { event: 'text'; data: { delta: string } }
  | { event: 'done'; data: { message: AgentMessage; conversation: AgentConversation } }
  | { event: 'error'; data: { error: AgentError } };
