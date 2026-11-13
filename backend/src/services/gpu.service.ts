import { Gpu, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { GpuListQuery, PeriodQuery } from '../schemas/gpu.schema';
import { AppError } from '../utils/AppError';
import { toGpu } from '../utils/serializers';
import { availableUnits, bookedUnitsByGpu, toPeriod } from './availability.service';

const ORDER_BY: Record<GpuListQuery['sort'], Prisma.GpuOrderByWithRelationInput[]> = { // tri demandé, puis id pour un ordre stable
  price_asc: [{ pricePerHour: 'asc' }, { id: 'asc' }],
  price_desc: [{ pricePerHour: 'desc' }, { id: 'asc' }],
  vram_desc: [{ vramGb: 'desc' }, { id: 'asc' }],
  name_asc: [{ name: 'asc' }, { id: 'asc' }],
};

export async function listGpus(query: GpuListQuery) {     // GET /gpus
  const where: Prisma.GpuWhereInput = {
    isActive: true,                                         // le catalogue public ne montre que les GPU actifs
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { architecture: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(query.manufacturer && { manufacturer: query.manufacturer }), // fabricant exact, ex. "NVIDIA"
    ...(query.minVram !== undefined && { vramGb: { gte: query.minVram } }),
    ...(query.maxPrice !== undefined && { pricePerHour: { lte: query.maxPrice } }),
  };

  const [rows, manufacturerRows] = await Promise.all([
    prisma.gpu.findMany({ where, orderBy: ORDER_BY[query.sort] }),
    prisma.gpu.findMany({                                   // tous les fabricants actifs, sans filtre (liste déroulante)
      where: { isActive: true },
      distinct: ['manufacturer'],
      select: { manufacturer: true },
      orderBy: { manufacturer: 'asc' },
    }),
  ]);

  const withUnits = await withAvailableUnits(rows, query);
  const gpus = query.available ? withUnits.filter((gpu) => gpu.availableUnits >= 1) : withUnits;

  return { gpus, total: gpus.length, manufacturers: manufacturerRows.map((row) => row.manufacturer) };
}

export async function getGpu(id: number, period: PeriodQuery) { // GET /gpus/:id
  const gpu = await prisma.gpu.findUnique({ where: { id } });
  if (!gpu || !gpu.isActive) {                              // un GPU désactivé est caché du public
    throw new AppError(404, 'GPU_NOT_FOUND', 'GPU not found.');
  }
  const [result] = await withAvailableUnits([gpu], period);
  return { gpu: result };
}

async function withAvailableUnits(gpus: Gpu[], period: PeriodQuery) { // ajoute availableUnits à chaque GPU
  const booked = await bookedUnitsByGpu(gpus.map((gpu) => gpu.id), toPeriod(period.startDate, period.durationHours));
  return gpus.map((gpu) => toGpu(gpu, availableUnits(gpu.totalUnits, booked.get(gpu.id) ?? 0)));
}
