import { GpuSummary } from './gpu';

export type ModelType = 'LLM' | 'VISION' | 'DIFFUSION' | 'AUDIO' | 'OTHER';
export type WorkloadMode = 'TRAINING' | 'INFERENCE';

export interface RecommendationRequest {
  modelType: ModelType;
  parametersBillions: number;
  mode: WorkloadMode;
  budgetPerHour: number;
}

export interface GpuConfiguration {
  gpu: GpuSummary;
  gpuCount: number;
  totalVramGb: number;
  totalPricePerHour: number;
  withinBudget: boolean;
}

export interface RecommendationResponse {
  input: RecommendationRequest;
  requiredVramGb: number;
  recommendation: GpuConfiguration | null;
  alternatives: GpuConfiguration[];
  explanation: string;
}
