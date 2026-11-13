export type WorkloadMode = 'PRETRAINING' | 'FULL_FINETUNE' | 'LORA' | 'QLORA' | 'INFERENCE'; // type de travail
export type Precision = 'FP32' | 'BF16' | 'FP16' | 'FP8' | 'INT8' | 'INT4';
export type FlashAttention = 'NONE' | 'FA2' | 'FA3';
export type Objective = 'lowest_cost' | 'fastest' | 'best_balance';

export interface WorkloadProfile {                          // ce que l'agent sait du travail de l'utilisateur
  mode: WorkloadMode;
  paramsBillions: number;                                   // taille du modèle, ex. 8 pour Llama 3.1 8B
  activeParamsBillions?: number;                            // MoE : paramètres actifs par token (sinon = paramsBillions)
  precision: Precision;
  layers?: number;                                          // nombre de couches du transformer
  hiddenSize?: number;
  kvHeads?: number;                                         // têtes clé/valeur (GQA)
  headDim?: number;                                         // dimension d'une tête
  contextLength?: number;                                   // tokens par séquence
  batchSize?: number;                                       // séquences en parallèle (par GPU à l'entraînement)
  trainingTokens?: number;                                  // tokens vus par époque (entraînement)
  epochs?: number;
  gradientCheckpointing?: boolean;
  sharded?: boolean;                                        // ZeRO-3 / FSDP : poids et états répartis sur les GPU
  usesCudaKernels?: boolean;                                // kernels CUDA spécifiques (.cu, bitsandbytes, TensorRT-LLM…)
  flashAttention?: FlashAttention;
}

export interface GpuSpecs {                                 // caractéristiques d'un GPU utiles au simulateur
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
  pricePerHour: number;                                     // prix d'un GPU pendant 1 heure
  totalUnits: number;
}

export interface GpuConfig {                                // ce que l'agent recommande : N GPU d'un même modèle
  gpu: GpuSpecs;
  gpuCount: number;
  pricePerHour: number;                                     // gpu.pricePerHour × gpuCount
}

export interface Simulation {                               // résultat du simulateur pour une configuration
  config: GpuConfig;
  compatible: boolean;
  exclusionReason: string | null;                           // pourquoi la configuration est écartée
  memoryRequiredGb: number;                                 // mémoire totale du travail
  memoryPerGpuGb: number;                                   // mémoire nécessaire sur chaque GPU
  hours: number | null;                                     // entraînement : durée estimée
  totalCost: number | null;                                 // entraînement : coût total estimé
  tokensPerSecond: number | null;                           // inférence : débit agrégé estimé
  costPerMillionTokens: number | null;                      // inférence : coût d'un million de tokens générés
  reasons: string[];                                        // points forts (anglais, affichés tels quels)
  warnings: string[];                                       // alertes (anglais)
}
