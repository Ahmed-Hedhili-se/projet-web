import { GpuSummary } from './gpu';

export type ModelType = 'LLM' | 'VISION' | 'DIFFUSION' | 'AUDIO' | 'OTHER'; // types de modèle acceptés
export type WorkloadMode = 'TRAINING' | 'INFERENCE';      // entraînement ou inférence

export interface RecommendationRequest {                   // body de POST /recommendations (docs/API.md, section 5)
  modelType: ModelType;
  parametersBillions: number;                              // de 0.01 à 2000
  mode: WorkloadMode;
  budgetPerHour: number;                                   // > 0, en dollars
}

export interface GpuConfiguration {                        // un GPU × un nombre d'unités
  gpu: GpuSummary;
  gpuCount: number;
  totalVramGb: number;
  totalPricePerHour: number;
  withinBudget: boolean;
}

export interface RecommendationResponse {                  // réponse de POST /recommendations
  input: RecommendationRequest;
  requiredVramGb: number;
  recommendation: GpuConfiguration | null;                 // null si aucun GPU ne convient
  alternatives: GpuConfiguration[];                        // 0 à 2 éléments
  explanation: string;
}
