import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export interface Period {
  start: Date;
  end: Date;
}

const HOUR_MS = 60 * 60 * 1000;

export function toPeriod(startDate?: Date, durationHours?: number): Period {
  const start = startDate ?? new Date();
  const hours = durationHours ?? 1;
  return { start, end: new Date(start.getTime() + hours * HOUR_MS) };
}

export async function bookedUnitsByGpu(gpuIds: number[], period: Period, db: Db = prisma) {
  if (gpuIds.length === 0) return new Map<number, number>();
  const rows = await db.rental.groupBy({
    by: ['gpuId'],
    where: {
      gpuId: { in: gpuIds },
      status: 'CONFIRMED',
      startDate: { lt: period.end },
      endDate: { gt: period.start },
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.gpuId, row._sum.quantity ?? 0]));
}

export function availableUnits(totalUnits: number, booked: number): number {
  return Math.max(0, totalUnits - booked);
}
