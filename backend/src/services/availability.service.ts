import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;         // client normal ou client d'une transaction

export interface Period {
  start: Date;                                              // début inclus
  end: Date;                                                // fin exclue
}

const HOUR_MS = 60 * 60 * 1000;

export function toPeriod(startDate?: Date, durationHours?: number): Period { // sans période : l'heure qui commence maintenant
  const start = startDate ?? new Date();
  const hours = durationHours ?? 1;
  return { start, end: new Date(start.getTime() + hours * HOUR_MS) };
}

export async function bookedUnitsByGpu(gpuIds: number[], period: Period, db: Db = prisma) { // gpuId → unités déjà louées
  if (gpuIds.length === 0) return new Map<number, number>();
  const rows = await db.rental.groupBy({
    by: ['gpuId'],
    where: {
      gpuId: { in: gpuIds },
      status: 'CONFIRMED',                                  // une location annulée libère ses unités
      startDate: { lt: period.end },                        // chevauchement : début avant la fin de la période
      endDate: { gt: period.start },                        //               et fin après le début de la période
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.gpuId, row._sum.quantity ?? 0]));
}

export function availableUnits(totalUnits: number, booked: number): number { // jamais négatif
  return Math.max(0, totalUnits - booked);
}
