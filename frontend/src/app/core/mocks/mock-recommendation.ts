import { Gpu } from '../models/gpu';
import {
  GpuConfiguration,
  ModelType,
  RecommendationRequest,
  RecommendationResponse,
} from '../models/recommendation';

const TYPE_FACTOR: Record<ModelType, number> = {
  // coefficient par type de modèle (docs/PLAN.md, section 8)
  LLM: 1.0,
  VISION: 1.1,
  DIFFUSION: 1.3,
  AUDIO: 1.0,
  OTHER: 1.0,
};

const TYPE_LABEL: Record<ModelType, string> = {
  // nom utilisé dans l'explication
  LLM: 'LLM',
  VISION: 'vision model',
  DIFFUSION: 'diffusion model',
  AUDIO: 'audio model',
  OTHER: 'model',
};

const MAX_GPUS = 8; // au-delà de 8 GPU, la configuration est écartée

export function mockRecommend(
  request: RecommendationRequest,
  catalog: Gpu[],
): RecommendationResponse {
  const bytesPerParam = request.mode === 'INFERENCE' ? 2 : 16; // FP16 en inférence ; poids + gradients + Adam en entraînement
  const requiredVramGb = round(
    request.parametersBillions * bytesPerParam * 1.2 * TYPE_FACTOR[request.modelType],
    1,
  );

  const configurations: GpuConfiguration[] = catalog
    .filter((gpu) => gpu.isActive)
    .map((gpu) => {
      const gpuCount = Math.max(1, Math.ceil(requiredVramGb / gpu.vramGb)); // nombre d'unités pour avoir assez de mémoire
      const totalPricePerHour = round(gpu.pricePerHour * gpuCount, 2);
      return {
        gpu: {
          id: gpu.id,
          name: gpu.name,
          manufacturer: gpu.manufacturer,
          vramGb: gpu.vramGb,
          pricePerHour: gpu.pricePerHour,
        },
        gpuCount,
        totalVramGb: gpu.vramGb * gpuCount,
        totalPricePerHour,
        withinBudget: totalPricePerHour <= request.budgetPerHour,
        tflops: gpu.fp16Tflops * gpuCount, // utilisé seulement pour départager
      };
    })
    .filter((config) => config.gpuCount <= MAX_GPUS)
    .sort(
      (a, b) =>
        a.totalPricePerHour - b.totalPricePerHour || a.gpuCount - b.gpuCount || b.tflops - a.tflops,
    )
    .map(({ tflops, ...config }) => config); // retire le champ interne « tflops »

  const recommendation =
    configurations.find((config) => config.withinBudget) ?? configurations[0] ?? null;
  const alternatives = configurations.filter((config) => config !== recommendation).slice(0, 2);

  return {
    input: request,
    requiredVramGb,
    recommendation,
    alternatives,
    explanation: explain(request, requiredVramGb, recommendation),
  };
}

function explain(
  request: RecommendationRequest,
  requiredVramGb: number,
  config: GpuConfiguration | null,
): string {
  const intro = `A ${request.parametersBillions}B ${TYPE_LABEL[request.modelType]} in ${request.mode.toLowerCase()} needs about ${requiredVramGb} GB of VRAM.`;
  if (!config) {
    return `${intro} No configuration of up to ${MAX_GPUS} GPUs in our catalog can hold it. Contact our team for a custom cluster.`;
  }
  const setup = `${config.gpuCount} × ${config.gpu.name} (${config.totalVramGb} GB)`;
  const budget = `$${request.budgetPerHour.toFixed(2)}/hour`;
  return config.withinBudget
    ? `${intro} ${setup} covers it for $${config.totalPricePerHour.toFixed(2)}/hour, within your ${budget} budget.`
    : `${intro} No configuration fits your ${budget} budget. The most affordable option is ${setup} at $${config.totalPricePerHour.toFixed(2)}/hour.`;
}

function round(value: number, decimals: number): number {
  // arrondi, ex. round(16.8000001, 1) → 16.8
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
