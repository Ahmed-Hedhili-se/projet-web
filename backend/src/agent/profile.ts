// Validation du profil de travail : protège le simulateur contre des valeurs absurdes envoyées par le LLM.
import { z } from 'zod';
import { WorkloadProfile } from './types';

const positiveInt = (max: number) => z.number().int().positive().max(max);

export const workloadProfileSchema = z.object({             // tous les champs optionnels : le profil se remplit petit à petit
  mode: z.enum(['PRETRAINING', 'FULL_FINETUNE', 'LORA', 'QLORA', 'INFERENCE']),
  paramsBillions: z.number().positive().max(2000),
  activeParamsBillions: z.number().positive().max(2000),
  precision: z.enum(['FP32', 'BF16', 'FP16', 'FP8', 'INT8', 'INT4']),
  layers: positiveInt(500),
  hiddenSize: positiveInt(100_000),
  kvHeads: positiveInt(1000),
  headDim: positiveInt(1000),
  contextLength: positiveInt(10_000_000),
  batchSize: positiveInt(100_000),
  trainingTokens: z.number().positive().max(1e14),          // 100 000 milliards de tokens au maximum
  epochs: z.number().positive().max(1000),
  gradientCheckpointing: z.boolean(),
  sharded: z.boolean(),
  usesCudaKernels: z.boolean(),
  flashAttention: z.enum(['NONE', 'FA2', 'FA3']),
}).partial().strict();                                      // strict : un champ inconnu est une erreur

export type PartialProfile = z.infer<typeof workloadProfileSchema>;

export function missingFields(profile: PartialProfile): string[] { // ce qu'il manque pour lancer une simulation
  const missing = (['mode', 'paramsBillions', 'precision'] as const).filter((field) => profile[field] === undefined);
  return missing as string[];
}

export function isComplete(profile: PartialProfile): profile is WorkloadProfile {
  return missingFields(profile).length === 0;
}
