import { GpuSummary } from './gpu';

export type RentalStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Rental {
  id: number;
  quantity: number;
  startDate: string;
  durationHours: number;
  endDate: string;
  totalPrice: number;
  status: RentalStatus;
  cancelledAt: string | null;
  createdAt: string;
  gpu: GpuSummary;
}

export interface CreateRentalRequest {
  gpuId: number;
  quantity: number;
  startDate: string;
  durationHours: number;
}

export interface RentalResponse {
  rental: Rental;
}

export interface RentalListResponse {
  rentals: Rental[];
  total: number;
}
