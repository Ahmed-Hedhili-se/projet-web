// Tests de l'outil rank_configs sur les GPU du seed (base de développement, pas de LLM).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RankResult, rankConfigs } from '../src/agent/rankConfigs';
import { WorkloadProfile } from '../src/agent/types';
import { prisma } from '../src/lib/prisma';
import { cleanupTestData, closeConnections, registerUser, waitForRedis } from './helpers';

const START = new Date('2099-05-01T09:00:00.000Z');         // période lointaine, réservée seulement par ces tests
const HOURS = 48;

const qlora8b: WorkloadProfile = {                          // Llama 3.1 8B en QLoRA, code CUDA (bitsandbytes)
  mode: 'QLORA', paramsBillions: 8, precision: 'BF16', layers: 32, hiddenSize: 4096, contextLength: 4096,
  gradientCheckpointing: true, usesCudaKernels: true, flashAttention: 'FA2', trainingTokens: 1e8,
};
const inference7b: WorkloadProfile = { mode: 'INFERENCE', paramsBillions: 7, precision: 'BF16' };

beforeAll(() => waitForRedis());
afterAll(async () => {
  await cleanupTestData();
  await closeConnections();
});

describe('rankConfigs', () => {
  it('ranks compatible configurations with prices read from the database', async () => {
    const result = (await rankConfigs(qlora8b)) as RankResult;

    expect(result.objective).toBe('best_balance');
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.items.length).toBeLessThanOrEqual(5);
    expect(result.items.map((i) => i.rank)).toEqual(result.items.map((_, index) => index + 1));
    expect(result.items[0].verdict).toBe('BEST_CHOICE');

    for (const item of result.items) {                      // prix = prix en base × nombre de GPU
      const gpu = await prisma.gpu.findUniqueOrThrow({ where: { id: item.gpuId } });
      expect(gpu.isActive).toBe(true);
      expect(item.pricePerHour).toBeCloseTo(Number(gpu.pricePerHour) * item.gpuCount, 2);
      expect(item.estimate.hours).toBeGreaterThan(0);
    }
    const cheapest = result.items.find((i) => i.verdict === 'CHEAPEST') ?? result.items[0];
    expect(cheapest.estimate.totalCost).toBe(Math.min(...result.items.map((i) => i.estimate.totalCost!)));
    expect(result.items.some((i) => i.gpuName === 'NVIDIA V100 32GB')).toBe(false); // désactivé
  });

  it('lists GPUs that cannot run the job, with the reason', async () => {
    const result = (await rankConfigs(qlora8b)) as RankResult;
    expect(result.excluded).toContainEqual({
      gpu: 'AMD Instinct MI300X',
      reason: 'Your code relies on CUDA-only kernels, which do not run on ROCm (AMD).',
    });
    expect(result.assumptions).toContain('All estimates are approximate (±30%).');
  });

  it('asks for the missing fields when the profile is incomplete', async () => {
    expect(await rankConfigs({ mode: 'LORA' })).toEqual({
      error: 'The workload profile is incomplete: ask the user or analyze the repository first.',
      missing: ['paramsBillions', 'precision'],
    });
  });

  it('excludes a GPU that is fully booked on the requested period', async () => {
    const before = (await rankConfigs(inference7b, { objective: 'lowest_cost', startDate: START, durationHours: HOURS })) as RankResult;
    const top = await prisma.gpu.findUniqueOrThrow({ where: { id: before.items[0].gpuId } }); // le moins cher par token

    const { user } = await registerUser('rank');
    await prisma.rental.create({                            // tout son stock loué sur la période
      data: {
        userId: user.id, gpuId: top.id, quantity: top.totalUnits, startDate: START, durationHours: HOURS,
        endDate: new Date(START.getTime() + HOURS * 3600_000), totalPrice: 0,
      },
    });

    const after = (await rankConfigs(inference7b, { objective: 'lowest_cost', startDate: START, durationHours: HOURS })) as RankResult;
    expect(after.items.some((i) => i.gpuId === top.id)).toBe(false);
    expect(after.excluded).toContainEqual({ gpu: top.name, reason: `Only 0 ${top.name} free on this period.` });
    const now = (await rankConfigs(inference7b, { objective: 'lowest_cost' })) as RankResult; // maintenant : il est libre
    expect(now.items[0].gpuId).toBe(top.id);
  });

  it('returns no item when nothing fits, and explains why for every GPU', async () => {
    const result = (await rankConfigs({ mode: 'FULL_FINETUNE', paramsBillions: 400, precision: 'BF16' })) as RankResult;
    expect(result.items).toEqual([]);
    const activeCount = await prisma.gpu.count({ where: { isActive: true } });
    expect(result.excluded).toHaveLength(activeCount);
    expect(result.excluded.every((e) => e.reason.startsWith('Not enough memory'))).toBe(true);
  });
});
