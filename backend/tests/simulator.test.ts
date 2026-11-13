// Tests du simulateur : fonctions pures, pas de base de données ni de LLM.
import { describe, expect, it } from 'vitest';
import { estimateMemory, generateConfigs, rankSimulations, simulate } from '../src/agent/simulator';
import { GpuSpecs, WorkloadProfile } from '../src/agent/types';

const base = { computeCapability: '8.0', eccMemory: true, fastInterconnect: false, fp8Tflops: null };
const HOPPER = ['FP64', 'FP32', 'TF32', 'BF16', 'FP16', 'FP8', 'INT8'];
const AMPERE = ['FP64', 'FP32', 'TF32', 'BF16', 'FP16', 'INT8'];

const H100: GpuSpecs = { ...base, id: 1, name: 'NVIDIA H100 80GB', architecture: 'Hopper', vramGb: 80, fp16Tflops: 989.5,
  fp8Tflops: 1979, memoryBandwidthGbs: 3350, supportedPrecisions: HOPPER, softwareStack: 'CUDA', computeCapability: '9.0',
  fastInterconnect: true, pricePerHour: 3.2, totalUnits: 8 };
const A100_40: GpuSpecs = { ...base, id: 3, name: 'NVIDIA A100 40GB', architecture: 'Ampere', vramGb: 40, fp16Tflops: 312,
  memoryBandwidthGbs: 1555, supportedPrecisions: AMPERE, softwareStack: 'CUDA', pricePerHour: 1.29, totalUnits: 10 };
const MI300X: GpuSpecs = { ...base, id: 4, name: 'AMD Instinct MI300X', architecture: 'CDNA 3', vramGb: 192, fp16Tflops: 1307.4,
  fp8Tflops: 2614.9, memoryBandwidthGbs: 5300, supportedPrecisions: HOPPER, softwareStack: 'ROCM', computeCapability: 'gfx942',
  fastInterconnect: true, pricePerHour: 3.49, totalUnits: 4 };
const RTX4090: GpuSpecs = { ...base, id: 5, name: 'NVIDIA RTX 4090', architecture: 'Ada Lovelace', vramGb: 24, fp16Tflops: 165,
  fp8Tflops: 330, memoryBandwidthGbs: 1008, supportedPrecisions: ['FP32', 'TF32', 'BF16', 'FP16', 'FP8', 'INT8'],
  softwareStack: 'CUDA', computeCapability: '8.9', eccMemory: false, pricePerHour: 0.69, totalUnits: 16 };
const V100: GpuSpecs = { ...base, id: 7, name: 'NVIDIA V100 32GB', architecture: 'Volta', vramGb: 32, fp16Tflops: 125,
  memoryBandwidthGbs: 900, supportedPrecisions: ['FP64', 'FP32', 'FP16', 'INT8'], softwareStack: 'CUDA',
  computeCapability: '7.0', fastInterconnect: true, pricePerHour: 0.89, totalUnits: 4 };

const one = (gpu: GpuSpecs, gpuCount = 1) => ({ gpu, gpuCount, pricePerHour: gpu.pricePerHour * gpuCount });

const llama8bInference: WorkloadProfile = {                 // Llama 3.1 8B en BF16, contexte 8K
  mode: 'INFERENCE', paramsBillions: 8, precision: 'BF16', layers: 32, kvHeads: 8, headDim: 128, contextLength: 8192,
};
const llama8bFinetune: WorkloadProfile = {                  // fine-tuning complet de 8B, contexte 4K, checkpointing
  mode: 'FULL_FINETUNE', paramsBillions: 8, precision: 'BF16', layers: 32, hiddenSize: 4096, contextLength: 4096,
  gradientCheckpointing: true,
};

describe('generateConfigs', () => {
  it('offers 1, 2, 4 and 8 GPUs within the stock', () => {
    const counts = generateConfigs([MI300X]).map((c) => c.gpuCount);
    expect(counts).toEqual([1, 2, 4]);                      // seulement 4 MI300X en stock
    expect(generateConfigs([H100]).at(-1)).toMatchObject({ gpuCount: 8, pricePerHour: 25.6 });
  });
});

describe('estimateMemory', () => {
  it('inference = (weights + KV cache) × 1.1', () => {
    // poids 8 × 2 = 16 Go ; cache KV 2 × 32 × 8 × 128 × 8192 × 2 / 1e9 = 1.07 Go ; × 1.1 = 18.8 Go
    expect(estimateMemory(llama8bInference, 1)).toEqual({ totalGb: 18.8, perGpuGb: 18.8 });
    expect(estimateMemory(llama8bInference, 2).perGpuGb).toBe(9.4);
  });

  it('full fine-tuning = 16 bytes/param + activations, divided by N only when sharded', () => {
    // état 16 × 8 = 128 Go ; activations 4096 × 4096 × 32 × 2 / 1e9 = 1.07 Go
    expect(estimateMemory(llama8bFinetune, 2)).toEqual({ totalGb: 129.1, perGpuGb: 129.1 });
    expect(estimateMemory({ ...llama8bFinetune, sharded: true }, 2).perGpuGb).toBe(65.1);
  });

  it('QLoRA is much lighter than full fine-tuning', () => {
    const qlora = estimateMemory({ ...llama8bFinetune, mode: 'QLORA' }, 1);
    expect(qlora.perGpuGb).toBe(6.4);                       // 0.5 × 8 + 0.16 × 8 + 1.07
  });
});

describe('simulate', () => {
  it('fits Llama 8B inference on one RTX 4090 and estimates tokens/s', () => {
    const sim = simulate(llama8bInference, one(RTX4090));
    expect(sim.compatible).toBe(true);
    expect(sim.tokensPerSecond).toBe(37.8);                 // 0.6 × 1008 / 16
    expect(sim.costPerMillionTokens).toBe(5.07);            // 0.69 / (37.8 × 3600) × 1e6
  });

  it('excludes a configuration without enough memory, accepts it when sharded on 2 GPUs', () => {
    expect(simulate(llama8bFinetune, one(H100)).exclusionReason).toMatch(/Not enough memory/);
    expect(simulate({ ...llama8bFinetune, sharded: true }, one(H100, 2)).compatible).toBe(true);
  });

  it('estimates training time and cost: 6 × P × tokens / (TFLOPS × MFU 0.4)', () => {
    const profile: WorkloadProfile = { mode: 'FULL_FINETUNE', paramsBillions: 1, precision: 'BF16', trainingTokens: 1e9 };
    const sim = simulate(profile, one(H100));
    expect(sim.hours).toBe(4.21);                           // 6e18 / (989.5e12 × 0.4) / 3600
    expect(sim.totalCost).toBe(13.47);                      // 3.2 × 4.2109 (calculé avant l'arrondi des heures)
  });

  it('uses FP8 TFLOPS on Hopper and excludes FP8 on Ampere', () => {
    const profile: WorkloadProfile = { mode: 'FULL_FINETUNE', paramsBillions: 1, precision: 'FP8', trainingTokens: 1e9 };
    const h100 = simulate(profile, one(H100));
    expect(h100.hours).toBe(2.11);                          // deux fois plus de TFLOPS en FP8
    expect(h100.reasons).toContain('Runs FP8 natively on Hopper.');
    expect(simulate(profile, one(A100_40)).exclusionReason).toBe('Ampere does not support FP8.');
  });

  it('excludes BF16 on Volta, CUDA kernels on ROCm and FlashAttention on old GPUs', () => {
    expect(simulate(llama8bInference, one(V100)).exclusionReason).toBe('Volta does not support BF16.');
    expect(simulate({ ...llama8bInference, usesCudaKernels: true }, one(MI300X)).exclusionReason).toMatch(/ROCm/);
    const fp16Fa2: WorkloadProfile = { ...llama8bInference, precision: 'FP16', flashAttention: 'FA2' };
    expect(simulate(fp16Fa2, one(V100)).exclusionReason).toMatch(/compute capability 8.0/);
  });

  it('warns about FlashAttention-3 outside Hopper and multi-GPU over PCIe (with a slower estimate)', () => {
    const profile: WorkloadProfile = { mode: 'LORA', paramsBillions: 1, precision: 'BF16', trainingTokens: 1e8, flashAttention: 'FA3' };
    const pcie = simulate(profile, one(A100_40, 2));
    expect(pcie.warnings).toEqual([
      'FlashAttention-3 needs Hopper: your code will fall back to FlashAttention-2 (slower).',
      'No NVLink between the GPUs: multi-GPU communication goes over PCIe (slower).',
    ]);
    const single = simulate(profile, one(A100_40));
    expect(pcie.hours! * 2 * 0.7).toBeCloseTo(single.hours!, 1); // 2 GPU mais efficacité × 0.7
  });

  it('loses 10% per GPU over NVLink: 8 GPUs are faster but cost a bit more in total', () => {
    const profile: WorkloadProfile = { mode: 'FULL_FINETUNE', paramsBillions: 1, precision: 'BF16', trainingTokens: 1e9 };
    const single = simulate(profile, one(H100));
    const eight = simulate(profile, one(H100, 8));
    expect(eight.hours! * 8 * 0.9).toBeCloseTo(single.hours!, 1);
    expect(eight.totalCost!).toBeCloseTo(single.totalCost! / 0.9, 1);
  });

  it('warns about long training without ECC memory', () => {
    const profile: WorkloadProfile = { mode: 'QLORA', paramsBillions: 7, precision: 'BF16', trainingTokens: 1e9 };
    expect(simulate(profile, one(RTX4090)).warnings).toContain(
      'Long training run on a GPU without ECC memory: a memory error could corrupt it.',
    );
  });
});

describe('rankSimulations', () => {
  const profile: WorkloadProfile = { mode: 'FULL_FINETUNE', paramsBillions: 1, precision: 'BF16', trainingTokens: 1e9 };
  const sims = generateConfigs([H100, A100_40, RTX4090, V100]).map((config) => simulate(profile, config));

  it('drops incompatible configurations', () => {
    const ranked = rankSimulations(sims, 'best_balance');
    expect(ranked.every((sim) => sim.compatible)).toBe(true);
    expect(ranked.some((sim) => sim.config.gpu.id === V100.id)).toBe(false); // BF16 non supporté
  });

  it('orders by total cost, by time, or by a balance of both', () => {
    const cheapest = rankSimulations(sims, 'lowest_cost')[0];
    const fastest = rankSimulations(sims, 'fastest')[0];
    const costs = sims.filter((s) => s.compatible).map((s) => s.totalCost!);
    expect(cheapest.totalCost).toBe(Math.min(...costs));
    expect(fastest.config).toMatchObject({ gpuCount: 8 });  // le plus de GPU = le plus rapide
    expect(fastest.config.gpu.id).toBe(H100.id);
    const balanced = rankSimulations(sims, 'best_balance')[0];
    expect(balanced.totalCost).toBeLessThanOrEqual(fastest.totalCost!);
    expect(balanced.hours).toBeLessThanOrEqual(cheapest.hours!);
  });

  it('returns an empty list when nothing fits', () => {
    const huge: WorkloadProfile = { mode: 'FULL_FINETUNE', paramsBillions: 400, precision: 'BF16' };
    expect(rankSimulations(generateConfigs([RTX4090]).map((c) => simulate(huge, c)), 'fastest')).toEqual([]);
  });
});
