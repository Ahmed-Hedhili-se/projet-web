// Outil rank_configs : simule toutes les configurations de GPU actives et renvoie un classement compact pour le LLM.
// Les prix et le stock viennent TOUJOURS de la base, jamais du LLM.
import { Gpu } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { availableUnits, bookedUnitsByGpu, toPeriod } from '../services/availability.service';
import { toPrice } from '../utils/serializers';
import { isComplete, missingFields, PartialProfile } from './profile';
import { generateConfigs, rankSimulations, simulate } from './simulator';
import { GpuSpecs, Objective, Simulation } from './types';

const MAX_ITEMS = 5;                                        // taille du classement renvoyé au LLM
const MAX_PER_MODEL = 2;                                    // évite 4 variantes du même GPU dans le top 5

export type Verdict = 'BEST_CHOICE' | 'CHEAPEST' | 'FASTEST' | 'ALTERNATIVE';

export interface RankedConfig {                             // une ligne du classement (format compact)
  rank: number;
  verdict: Verdict;
  gpuId: number;
  gpuName: string;
  architecture: string;                                     // ex. "Hopper" : ce que l'utilisateur veut comprendre
  gpuCount: number;
  pricePerHour: number;                                     // prix de la configuration entière
  availableUnits: number;                                   // GPU de ce modèle libres sur la période
  estimate: {
    memoryRequiredGb: number;
    memoryPerGpuGb: number;
    hours: number | null;
    totalCost: number | null;
    tokensPerSecond: number | null;
    costPerMillionTokens: number | null;
  };
  reasons: string[];
  warnings: string[];
}

export interface RankResult {
  objective: Objective;
  simulated: number;                                        // nombre de configurations simulées
  items: RankedConfig[];
  excluded: { gpu: string; reason: string }[];              // un GPU par ligne : pourquoi aucune de ses configurations ne convient
  assumptions: string[];
}

export interface RankOptions {
  objective?: Objective;
  startDate?: Date;                                         // période voulue (sinon : l'heure qui commence)
  durationHours?: number;
}

export function toSpecs(gpu: Gpu): GpuSpecs {               // ligne Prisma → données du simulateur
  return {
    id: gpu.id, name: gpu.name, architecture: gpu.architecture, vramGb: gpu.vramGb, fp16Tflops: gpu.fp16Tflops,
    fp8Tflops: gpu.fp8Tflops, memoryBandwidthGbs: gpu.memoryBandwidthGbs, supportedPrecisions: gpu.supportedPrecisions,
    softwareStack: gpu.softwareStack, computeCapability: gpu.computeCapability, eccMemory: gpu.eccMemory,
    fastInterconnect: gpu.fastInterconnect, pricePerHour: toPrice(gpu.pricePerHour), totalUnits: gpu.totalUnits,
  };
}

export async function rankConfigs(profile: PartialProfile, options: RankOptions = {}): Promise<RankResult | { error: string; missing: string[] }> {
  if (!isComplete(profile)) {                               // le LLM doit d'abord compléter le profil
    return { error: 'The workload profile is incomplete: ask the user or analyze the repository first.', missing: missingFields(profile) };
  }
  const objective = options.objective ?? 'best_balance';

  const gpus = await prisma.gpu.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  const booked = await bookedUnitsByGpu(gpus.map((g) => g.id), toPeriod(options.startDate, options.durationHours));
  const free = new Map(gpus.map((g) => [g.id, availableUnits(g.totalUnits, booked.get(g.id) ?? 0)]));

  const sims = generateConfigs(gpus.map(toSpecs)).map((config) => {
    const sim = simulate(profile, config);
    const available = free.get(config.gpu.id)!;
    if (sim.compatible && config.gpuCount > available) {    // la configuration tiendrait, mais pas assez de GPU libres
      return { ...sim, compatible: false, exclusionReason: `Only ${available} ${config.gpu.name} free on this period.` };
    }
    return sim;
  });

  const ranked = rankSimulations(sims, objective);
  const picked = pickItems(ranked, [
    ['BEST_CHOICE', ranked[0]],
    ['CHEAPEST', rankSimulations(sims, 'lowest_cost')[0]],
    ['FASTEST', rankSimulations(sims, 'fastest')[0]],
  ]);

  return {
    objective,
    simulated: sims.length,
    items: picked.map(([verdict, sim], index) => toRanked(sim, verdict, index + 1, free.get(sim.config.gpu.id)!)),
    excluded: excludedModels(sims),
    assumptions: assumptionsFor(profile.mode),
  };
}

function pickItems(ranked: Simulation[], highlights: [Verdict, Simulation | undefined][]): [Verdict, Simulation][] {
  const result: [Verdict, Simulation][] = [];
  const perModel = new Map<number, number>();
  const add = (verdict: Verdict, sim: Simulation) => {
    if (result.some(([, s]) => s === sim)) return;          // déjà dans la liste (ex. le moins cher est aussi le meilleur)
    const count = perModel.get(sim.config.gpu.id) ?? 0;
    if (verdict === 'ALTERNATIVE' && count >= MAX_PER_MODEL) return;
    perModel.set(sim.config.gpu.id, count + 1);
    result.push([verdict, sim]);
  };
  for (const [verdict, sim] of highlights) if (sim) add(verdict, sim); // meilleur, moins cher, plus rapide d'abord
  for (const sim of ranked) if (result.length < MAX_ITEMS) add('ALTERNATIVE', sim);
  return result.slice(0, MAX_ITEMS);
}

function toRanked(sim: Simulation, verdict: Verdict, rank: number, free: number): RankedConfig {
  return {
    rank, verdict,
    gpuId: sim.config.gpu.id, gpuName: sim.config.gpu.name, architecture: sim.config.gpu.architecture,
    gpuCount: sim.config.gpuCount,
    pricePerHour: sim.config.pricePerHour, availableUnits: free,
    estimate: {
      memoryRequiredGb: sim.memoryRequiredGb, memoryPerGpuGb: sim.memoryPerGpuGb,
      hours: sim.hours, totalCost: sim.totalCost,
      tokensPerSecond: sim.tokensPerSecond, costPerMillionTokens: sim.costPerMillionTokens,
    },
    reasons: sim.reasons, warnings: sim.warnings,
  };
}

function excludedModels(sims: Simulation[]) {               // GPU dont AUCUNE configuration ne convient, avec la raison de la plus grande
  const byGpu = new Map<string, Simulation[]>();
  for (const sim of sims) byGpu.set(sim.config.gpu.name, [...(byGpu.get(sim.config.gpu.name) ?? []), sim]);
  return [...byGpu.entries()]
    .filter(([, list]) => list.every((sim) => !sim.compatible))
    .map(([gpu, list]) => ({ gpu, reason: list.at(-1)!.exclusionReason! }));
}

function assumptionsFor(mode: string): string[] {           // hypothèses affichées avec les estimations
  const common = 'All estimates are approximate (±30%).';
  if (mode === 'INFERENCE') {
    return [common, 'Generation speed is limited by memory bandwidth (60% efficiency); weights are split across GPUs.'];
  }
  return [
    common,
    'Training compute: 6 FLOPs per parameter per token (4 for LoRA / QLoRA).',
    'GPU efficiency (MFU): 40% (25% for QLoRA); with several GPUs ×0.9 over NVLink, ×0.7 over PCIe.',
  ];
}
