export type WorkloadMode = 'PRETRAINING' | 'FULL_FINETUNE' | 'LORA' | 'QLORA' | 'INFERENCE';
export type Precision = 'FP32' | 'BF16' | 'FP16' | 'FP8' | 'INT8' | 'INT4';
export type FlashAttention = 'NONE' | 'FA2' | 'FA3';
export type Objective = 'lowest_cost' | 'fastest' | 'best_balance';

export interface WorkloadProfile {
  mode: WorkloadMode;
  paramsBillions: number;
  activeParamsBillions?: number;
  precision: Precision;
  layers?: number;
  hiddenSize?: number;
  kvHeads?: number;
  headDim?: number;
  contextLength?: number;
  batchSize?: number;
  trainingTokens?: number;
  epochs?: number;
  gradientCheckpointing?: boolean;
  sharded?: boolean;
  usesCudaKernels?: boolean;
  flashAttention?: FlashAttention;
}

export interface GpuSpecs {
  id: number;
  name: string;
  architecture: string;
  vramGb: number;
  fp16Tflops: number;
  fp8Tflops: number | null;
  memoryBandwidthGbs: number;
  supportedPrecisions: string[];
  softwareStack: 'CUDA' | 'ROCM';
  computeCapability: string;
  eccMemory: boolean;
  fastInterconnect: boolean;
  pricePerHour: number;
  totalUnits: number;
}

export interface GpuConfig {
  gpu: GpuSpecs;
  gpuCount: number;
  pricePerHour: number;
}

export interface Simulation {
  config: GpuConfig;
  compatible: boolean;
  exclusionReason: string | null;
  memoryRequiredGb: number;
  memoryPerGpuGb: number;
  hours: number | null;
  totalCost: number | null;
  tokensPerSecond: number | null;
  costPerMillionTokens: number | null;
  reasons: string[];
  warnings: string[];
}
