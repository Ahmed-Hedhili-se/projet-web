// Simulateur du conseiller IA : calculs déterministes (pas de LLM) — formules de PLAN.md, section 9.
import { GpuConfig, GpuSpecs, Objective, Precision, Simulation, WorkloadProfile } from './types';

const BYTES_PER_PARAM: Record<Precision, number> = {        // octets par paramètre selon la précision
  FP32: 4, BF16: 2, FP16: 2, FP8: 1, INT8: 1, INT4: 0.5,
};
const GPU_COUNTS = [1, 2, 4, 8];                            // tailles de configuration proposées
const MEMORY_MARGIN = 0.9;                                  // on garde 10 % de VRAM libre (fragmentation, CUDA)
const DEFAULT_CONTEXT = 2048;
const DEFAULT_BATCH = 1;

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const isTraining = (profile: WorkloadProfile) => profile.mode !== 'INFERENCE';
const activeParams = (profile: WorkloadProfile) => profile.activeParamsBillions ?? profile.paramsBillions;

export function generateConfigs(gpus: GpuSpecs[]): GpuConfig[] { // 1×, 2×, 4×, 8× de chaque GPU (dans la limite du stock)
  return gpus.flatMap((gpu) =>
    GPU_COUNTS.filter((count) => count <= gpu.totalUnits).map((gpuCount) => ({
      gpu,
      gpuCount,
      pricePerHour: round(gpu.pricePerHour * gpuCount, 2),
    })),
  );
}

export function estimateMemory(profile: WorkloadProfile, gpuCount: number) { // mémoire totale et par GPU (Go)
  const P = profile.paramsBillions;                         // milliards de paramètres → Go directement (1e9 octets)

  if (!isTraining(profile)) {                               // inférence : poids + cache KV, répartis sur les GPU
    const weights = P * BYTES_PER_PARAM[profile.precision];
    const total = (weights + kvCacheGb(profile)) * 1.1;
    return { totalGb: round(total), perGpuGb: round(total / gpuCount) };
  }

  const state =                                             // poids + gradients + états de l'optimiseur
    profile.mode === 'LORA' ? 2 * P + 16 * 0.01 * P :       // modèle figé en BF16 + adaptateurs (~1 % des paramètres)
    profile.mode === 'QLORA' ? 0.5 * P + 16 * 0.01 * P :    // modèle figé en 4 bits + adaptateurs
    16 * P;                                                 // Adam en précision mixte : 16 octets par paramètre
  const activations = activationsGb(profile);
  const perGpu = (profile.sharded ? state / gpuCount : state) + activations; // ZeRO-3 / FSDP divise l'état
  return { totalGb: round(state + activations), perGpuGb: round(perGpu) };
}

function kvCacheGb(profile: WorkloadProfile): number {     // 2 (K et V) × couches × têtes KV × dim × contexte × batch × 2 octets
  const { layers, kvHeads, headDim } = profile;
  if (!layers || !kvHeads || !headDim) return 0;            // architecture inconnue : couvert par la marge de 10 %
  const tokens = (profile.contextLength ?? DEFAULT_CONTEXT) * (profile.batchSize ?? DEFAULT_BATCH);
  return (2 * layers * kvHeads * headDim * tokens * 2) / 1e9;
}

function activationsGb(profile: WorkloadProfile): number { // mémoire des activations pendant l'entraînement
  const k = profile.gradientCheckpointing ? 2 : 34;         // le checkpointing recalcule au lieu de stocker
  if (profile.hiddenSize && profile.layers) {
    const tokens = (profile.contextLength ?? DEFAULT_CONTEXT) * (profile.batchSize ?? DEFAULT_BATCH);
    return (tokens * profile.hiddenSize * profile.layers * k) / 1e9;
  }
  return profile.paramsBillions * (profile.gradientCheckpointing ? 0.25 : 2); // architecture inconnue : estimation grossière
}

function requiredPrecision(profile: WorkloadProfile): string | null { // précision que le GPU doit supporter
  if (profile.precision === 'INT4' || profile.precision === 'FP32') return null; // INT4 = kernels logiciels, FP32 partout
  return profile.precision;
}

export function simulate(profile: WorkloadProfile, config: GpuConfig): Simulation { // une configuration → estimation
  const { gpu, gpuCount } = config;
  const memory = estimateMemory(profile, gpuCount);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const result: Simulation = {
    config, compatible: false, exclusionReason: null,
    memoryRequiredGb: memory.totalGb, memoryPerGpuGb: memory.perGpuGb,
    hours: null, totalCost: null, tokensPerSecond: null, costPerMillionTokens: null,
    reasons, warnings,
  };
  const exclude = (reason: string) => ({ ...result, exclusionReason: reason });

  const precision = requiredPrecision(profile);             // 1. précision
  if (precision && !gpu.supportedPrecisions.includes(precision)) {
    return exclude(`${gpu.architecture} does not support ${precision}.`);
  }
  if (gpu.softwareStack === 'ROCM' && (profile.usesCudaKernels || (profile.flashAttention ?? 'NONE') !== 'NONE')) {
    return exclude('Your code relies on CUDA-only kernels, which do not run on ROCm (AMD).'); // 2. logiciel
  }
  if ((profile.flashAttention ?? 'NONE') !== 'NONE' && gpu.softwareStack === 'CUDA' && Number(gpu.computeCapability) < 8) {
    return exclude(`FlashAttention needs compute capability 8.0 or newer (${gpu.name} is ${gpu.computeCapability}).`);
  }
  const usableVram = gpu.vramGb * MEMORY_MARGIN;            // 3. mémoire
  if (memory.perGpuGb > usableVram) {
    return exclude(`Not enough memory: ${memory.perGpuGb} GB needed per GPU, ${gpu.vramGb} GB available.`);
  }

  result.compatible = true;
  reasons.push(`Fits in memory: ${memory.perGpuGb} GB needed per GPU, ${gpu.vramGb} GB available.`);
  if (profile.flashAttention === 'FA3' && gpu.architecture !== 'Hopper') {
    warnings.push('FlashAttention-3 needs Hopper: your code will fall back to FlashAttention-2 (slower).');
  }
  const slowLink = gpuCount > 1 && !gpu.fastInterconnect;
  if (slowLink) warnings.push('No NVLink between the GPUs: multi-GPU communication goes over PCIe (slower).');
  else if (gpuCount > 1) reasons.push('GPUs are linked by a fast interconnect (NVLink / Infinity Fabric).');

  if (isTraining(profile)) {
    const useFp8 = profile.precision === 'FP8' && gpu.fp8Tflops !== null;
    if (useFp8) reasons.push(`Runs FP8 natively on ${gpu.architecture}.`);
    if (profile.trainingTokens) {
      const factor = profile.mode === 'LORA' || profile.mode === 'QLORA' ? 4 : 6; // FLOPs par paramètre et par token
      const flops = factor * activeParams(profile) * 1e9 * profile.trainingTokens * (profile.epochs ?? 1);
      const tflops = useFp8 ? gpu.fp8Tflops! : gpu.fp16Tflops;
      const scaling = gpuCount === 1 ? 1 : slowLink ? 0.7 : 0.9; // temps perdu à synchroniser les GPU entre eux
      const mfu = (profile.mode === 'QLORA' ? 0.25 : 0.4) * scaling; // part réellement utilisée du GPU
      const hours = flops / (gpuCount * tflops * 1e12 * mfu) / 3600;
      result.hours = round(hours, 2);
      result.totalCost = round(config.pricePerHour * hours, 2);
      if (hours > 24 && !gpu.eccMemory) warnings.push('Long training run on a GPU without ECC memory: a memory error could corrupt it.');
    }
  } else {
    const activeWeightsGb = activeParams(profile) * BYTES_PER_PARAM[profile.precision]; // lus à chaque token généré
    const single = (0.6 * gpu.memoryBandwidthGbs * gpuCount) / activeWeightsGb; // génération limitée par la bande passante
    const batch = profile.batchSize ?? DEFAULT_BATCH;
    const aggregate = batch > 1 ? single * batch * 0.8 : single;
    const computeCap = (gpuCount * gpu.fp16Tflops * 1e12 * 0.5) / (2 * activeParams(profile) * 1e9); // plafond du calcul
    const tokensPerSecond = Math.min(aggregate, computeCap);
    result.tokensPerSecond = round(tokensPerSecond);
    result.costPerMillionTokens = round((config.pricePerHour / (tokensPerSecond * 3600)) * 1e6, 2);
  }
  return result;
}

export function rankSimulations(sims: Simulation[], objective: Objective): Simulation[] { // compatibles, du meilleur au moins bon
  const compatible = sims.filter((sim) => sim.compatible);
  if (compatible.length === 0) return [];
  const cost = (sim: Simulation) => sim.totalCost ?? sim.costPerMillionTokens ?? sim.config.pricePerHour;
  const time = (sim: Simulation) =>                         // plus petit = plus rapide
    sim.hours ?? (sim.tokensPerSecond ? 1 / sim.tokensPerSecond : 1 / (sim.config.gpu.fp16Tflops * sim.config.gpuCount));
  const minCost = Math.min(...compatible.map(cost));
  const minTime = Math.min(...compatible.map(time));
  const score = (sim: Simulation) =>
    objective === 'lowest_cost' ? cost(sim) :
    objective === 'fastest' ? time(sim) :
    0.5 * (cost(sim) / minCost) + 0.5 * (time(sim) / minTime); // best_balance : coût et temps relatifs

  return [...compatible].sort((a, b) =>
    score(a) - score(b) || a.config.gpuCount - b.config.gpuCount || a.config.gpu.id - b.config.gpu.id); // égalité : moins de GPU
}
