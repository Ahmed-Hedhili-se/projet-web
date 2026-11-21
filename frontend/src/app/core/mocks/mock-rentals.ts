import { Gpu, toGpuSummary } from '../models/gpu';
import { Rental, RentalStatus } from '../models/rental';
import { allMockGpus } from './mock-gpus';

export interface MockRentalRecord {
  id: number;
  userId: number;
  gpuId: number;
  quantity: number;
  startDate: string;
  durationHours: number;
  endDate: string;
  totalPrice: number;
  cancelled: boolean;
  cancelledAt: string | null;
  createdAt: string;
}

const RENTALS_KEY = 'teramind_mock_rentals_v3';
const HOUR_MS = 60 * 60 * 1000;
let memoryRentals: MockRentalRecord[] | null = null;

export function allMockRentals(): MockRentalRecord[] {
  try {
    const json = localStorage.getItem(RENTALS_KEY);
    if (json) {
      return JSON.parse(json) as MockRentalRecord[];
    }
  } catch {
    return memoryRentals ?? seedRentals();
  }
  const seeded = seedRentals();
  saveMockRentals(seeded);
  return seeded;
}

export function saveMockRentals(rentals: MockRentalRecord[]): void {
  memoryRentals = rentals;
  try {
    localStorage.setItem(RENTALS_KEY, JSON.stringify(rentals));
  } catch {
    return;
  }
}

export function createRecord(
  userId: number,
  gpu: Gpu,
  quantity: number,
  start: Date,
  durationHours: number,
): MockRentalRecord {
  const rentals = allMockRentals();
  const record: MockRentalRecord = {
    id: Math.max(0, ...rentals.map((rental) => rental.id)) + 1,
    userId,
    gpuId: gpu.id,
    quantity,
    startDate: start.toISOString(),
    durationHours,
    endDate: new Date(start.getTime() + durationHours * HOUR_MS).toISOString(),
    totalPrice: Math.round(gpu.pricePerHour * quantity * durationHours * 100) / 100,
    cancelled: false,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
  };
  saveMockRentals([...rentals, record]);
  return record;
}

export function rentalStatus(record: MockRentalRecord, now = Date.now()): RentalStatus {
  if (record.cancelled) return 'CANCELLED';
  if (now < Date.parse(record.startDate)) return 'UPCOMING';
  if (now < Date.parse(record.endDate)) return 'ACTIVE';
  return 'COMPLETED';
}

export function toApiRental(record: MockRentalRecord): Rental {
  const gpu = allMockGpus().find((item) => item.id === record.gpuId)!;
  return {
    id: record.id,
    quantity: record.quantity,
    startDate: record.startDate,
    durationHours: record.durationHours,
    endDate: record.endDate,
    totalPrice: record.totalPrice,
    status: rentalStatus(record),
    cancelledAt: record.cancelledAt,
    createdAt: record.createdAt,
    gpu: toGpuSummary(gpu),
  };
}

export function availableUnits(gpu: Gpu, start: Date, end: Date): number {
  const booked = allMockRentals()
    .filter((rental) => rental.gpuId === gpu.id && !rental.cancelled)
    .filter(
      (rental) =>
        Date.parse(rental.startDate) < end.getTime() &&
        Date.parse(rental.endDate) > start.getTime(),
    )
    .reduce((sum, rental) => sum + rental.quantity, 0);
  return Math.max(0, gpu.availableUnits - booked);
}

function seedRentals(): MockRentalRecord[] {
  const hour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const make = (
    id: number,
    userId: number,
    gpuId: number,
    quantity: number,
    startOffsetHours: number,
    durationHours: number,
    cancelled = false,
  ): MockRentalRecord => {
    const gpu = allMockGpus().find((item) => item.id === gpuId)!;
    const start = hour + startOffsetHours * HOUR_MS;
    return {
      id,
      userId,
      gpuId,
      quantity,
      startDate: new Date(start).toISOString(),
      durationHours,
      endDate: new Date(start + durationHours * HOUR_MS).toISOString(),
      totalPrice: Math.round(gpu.pricePerHour * quantity * durationHours * 100) / 100,
      cancelled,
      cancelledAt: cancelled ? new Date(start - 30 * HOUR_MS).toISOString() : null,
      createdAt: new Date(start - 72 * HOUR_MS).toISOString(),
    };
  };
  const history = Array.from({ length: 40 }, (_, i) => {
    const startOffset = -Math.round(150 + 4000 * Math.pow(i / 40, 1.6));
    const gpuId = [1, 2, 3, 5, 6, 4][i % 6];
    const duration = [8, 24, 48, 72, 12][i % 5];
    return make(100 + i, 4 + (i % 4), gpuId, 1 + (i % 3), startOffset, duration, i % 7 === 6);
  });
  return [
    make(11, 3, 6, 1, -480, 8, true),
    make(12, 3, 2, 4, -240, 72),
    make(14, 3, 5, 1, -6, 24),
    make(15, 3, 1, 2, 48, 48),
    make(16, 1, 3, 1, 24, 12),
    make(17, 4, 2, 2, -30, 72),
    make(18, 5, 1, 1, 30, 96),
    make(19, 6, 6, 3, 72, 48),
    make(20, 7, 3, 2, -20, 36),
    make(21, 4, 5, 1, 110, 24),
    ...history,
  ];
}
