export type AgentRole = 'USER' | 'ASSISTANT'; // objets de docs/API.md, section 10 (conseiller IA)
export type Verdict = 'BEST_CHOICE' | 'CHEAPEST' | 'FASTEST' | 'ALTERNATIVE';
export type AgentWorkloadMode = 'PRETRAINING' | 'FULL_FINETUNE' | 'LORA' | 'QLORA' | 'INFERENCE';
export type AgentPrecision = 'FP32' | 'BF16' | 'FP16' | 'FP8' | 'INT8' | 'INT4';

export interface AgentStatus {
  // réponse de GET /agent/status
  available: boolean; // false → afficher le formulaire de secours
  model: string;
  dailyMessageLimit: number;
  messagesUsedToday: number;
}

export interface AgentConversation {
  // objet « AgentConversation »
  id: number;
  title: string; // "New conversation" puis le début du premier message
  repoUrl: string | null; // dernier dépôt analysé
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentStep {
  // étape de travail de l'agent (« 3 steps »)
  tool: string;
  label: string;
}

export interface ProfileFact {
  // fait trouvé dans le dépôt, avec le fichier qui le prouve
  field: string;
  value: string | number | boolean;
  evidence: string;
}

export interface WorkloadProfile {
  // ce que l'IA a compris du travail (tous les champs sont optionnels)
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
  // carte « profile »
  type: 'profile';
  repoUrl: string | null;
  profile: WorkloadProfile;
  facts: ProfileFact[];
  missing: string[]; // mode, paramsBillions, precision, trainingTokens
}

export interface ConfigItem {
  // une configuration recommandée
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
  pricePerHour: number; // prix de la configuration entière
  availableUnits: number;
  estimate: {
    memoryRequiredGb: number;
    memoryPerGpuGb: number;
    hours: number | null; // entraînement
    totalCost: number | null;
    tokensPerSecond: number | null; // inférence
    costPerMillionTokens: number | null;
  };
  reasons: string[]; // phrases en anglais, affichées telles quelles
  warnings: string[];
  rentPath: string; // ex. /account/rentals/new?gpuId=1&quantity=8
}

export interface ConfigsCard {
  // carte « configs » (1 à 3 configurations)
  type: 'configs';
  items: ConfigItem[];
}

export interface RepliesCard {
  // carte « replies » : boutons de réponse rapide
  type: 'replies';
  options: string[];
}

export type AgentCard = ProfileCard | ConfigsCard | RepliesCard;

export interface AgentMessage {
  // objet « AgentMessage »
  id: number;
  role: AgentRole;
  content: string; // Markdown
  steps: AgentStep[];
  cards: AgentCard[]; // dans l'ordre : profile, configs, replies
  createdAt: string;
}

export interface AgentError {
  // erreur renvoyée par l'agent (avant ou pendant le flux)
  code: string;
  message: string;
}

export type AgentEvent =
  // événements du flux SSE de POST /agent/conversations/:id/messages
  | { event: 'user_message'; data: { message: AgentMessage } }
  | { event: 'step'; data: AgentStep }
  | { event: 'card'; data: { card: AgentCard } }
  | { event: 'text'; data: { delta: string } }
  | { event: 'done'; data: { message: AgentMessage; conversation: AgentConversation } }
  | { event: 'error'; data: { error: AgentError } };
