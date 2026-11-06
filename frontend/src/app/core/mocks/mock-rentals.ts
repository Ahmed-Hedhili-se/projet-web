import { Gpu, toGpuSummary } from '../models/gpu';
import { Rental, RentalStatus } from '../models/rental';
import { allMockGpus } from './mock-gpus';

export interface MockRentalRecord {                        // ce que la base de données stockerait (table rentals)
  id: number;
  userId: number;
  gpuId: number;
  quantity: number;
  startDate: string;
  durationHours: number;
  endDate: string;
  totalPrice: number;
  cancelled: boolean;                                      // status CONFIRMED ou CANCELLED en base
  cancelledAt: string | null;
  createdAt: string;
}

const RENTALS_KEY = 'teramind_mock_rentals_v2';           // locations fictives, gardées dans le navigateur
const HOUR_MS = 60 * 60 * 1000;
let memoryRentals: MockRentalRecord[] | null = null;       // secours si le localStorage est indisponible

export function allMockRentals(): MockRentalRecord[] {
  try {
    const json = localStorage.getItem(RENTALS_KEY);
    if (json) {
      return JSON.parse(json) as MockRentalRecord[];
    }
  } catch {
    return memoryRentals ?? seedRentals();
  }
  const seeded = seedRentals();                            // premier lancement : quelques locations d'exemple
  saveMockRentals(seeded);
  return seeded;
}

export function saveMockRentals(rentals: MockRentalRecord[]): void {
  memoryRentals = rentals;
  try {
    localStorage.setItem(RENTALS_KEY, JSON.stringify(rentals));
  } catch {                                                // stockage indisponible : la liste reste en mémoire
    return;
  }
}

export function createRecord(userId: number, gpu: Gpu, quantity: number, start: Date, durationHours: number): MockRentalRecord {
  const rentals = allMockRentals();
  const record: MockRentalRecord = {
    id: Math.max(0, ...rentals.map((rental) => rental.id)) + 1,
    userId,
    gpuId: gpu.id,
    quantity,
    startDate: start.toISOString(),
    durationHours,
    endDate: new Date(start.getTime() + durationHours * HOUR_MS).toISOString(), // calculé par le backend
    totalPrice: Math.round(gpu.pricePerHour * quantity * durationHours * 100) / 100, // calculé par le backend
    cancelled: false,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
  };
  saveMockRentals([...rentals, record]);
  return record;
}

export function rentalStatus(record: MockRentalRecord, now = Date.now()): RentalStatus { // statut renvoyé par l'API
  if (record.cancelled) return 'CANCELLED';
  if (now < Date.parse(record.startDate)) return 'UPCOMING';
  if (now < Date.parse(record.endDate)) return 'ACTIVE';
  return 'COMPLETED';
}

export function toApiRental(record: MockRentalRecord): Rental { // enregistrement → objet « Rental » de docs/API.md
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

export function availableUnits(gpu: Gpu, start: Date, end: Date): number { // unités libres sur une période (docs/PLAN.md, section 7)
  const booked = allMockRentals()
    .filter((rental) => rental.gpuId === gpu.id && !rental.cancelled)
    .filter((rental) => Date.parse(rental.startDate) < end.getTime() && Date.parse(rental.endDate) > start.getTime()) // chevauchement
    .reduce((sum, rental) => sum + rental.quantity, 0);
  return Math.max(0, gpu.availableUnits - booked);         // gpu.availableUnits = unités non louées par les autres clients fictifs
}

function seedRentals(): MockRentalRecord[] {               // exemples pour Jane (id 3) et l'admin (id 1), autour de maintenant
  const hour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS; // heure pile actuelle
  const make = (id: number, userId: number, gpuId: number, quantity: number, startOffsetHours: number, durationHours: number, cancelled = false): MockRentalRecord => {
    const gpu = allMockGpus().find((item) => item.id === gpuId)!;
    const start = hour + startOffsetHours * HOUR_MS;
    return {
      id, userId, gpuId, quantity,
      startDate: new Date(start).toISOString(),
      durationHours,
      endDate: new Date(start + durationHours * HOUR_MS).toISOString(),
      totalPrice: Math.round(gpu.pricePerHour * quantity * durationHours * 100) / 100,
      cancelled,
      cancelledAt: cancelled ? new Date(start - 30 * HOUR_MS).toISOString() : null,
      createdAt: new Date(start - 72 * HOUR_MS).toISOString(),
    };
  };
  const history = Array.from({ length: 40 }, (_, i) => {   // 40 locations passées des clients fictifs (id 4 à 7), sur ~6 mois
    const startOffset = -Math.round(150 + 4000 * Math.pow(i / 40, 1.6)); // plus nombreuses récemment : la courbe monte
    const gpuId = [1, 2, 3, 5, 6, 4][i % 6];
    const duration = [8, 24, 48, 72, 12][i % 5];
    return make(100 + i, 4 + (i % 4), gpuId, 1 + (i % 3), startOffset, duration, i % 7 === 6); // une sur sept annulée
  });
  return [
    make(11, 3, 6, 1, -480, 8, true),                      // annulée, il y a 20 jours
    make(12, 3, 2, 4, -240, 72),                           // terminée, il y a 10 jours
    make(14, 3, 5, 1, -6, 24),                             // en cours depuis 6 h
    make(15, 3, 1, 2, 48, 48),                             // à venir, dans 2 jours
    make(16, 1, 3, 1, 24, 12),                             // à venir, pour l'admin
    ...history,
  ];
}
