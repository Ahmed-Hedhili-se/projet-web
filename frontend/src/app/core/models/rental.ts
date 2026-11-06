import { GpuSummary } from './gpu';

export type RentalStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; // statut calculé par le backend

export interface Rental {                                  // objet « Rental » de docs/API.md
  id: number;
  quantity: number;                                        // nombre d'unités louées
  startDate: string;                                       // date ISO 8601
  durationHours: number;
  endDate: string;                                         // startDate + durationHours
  totalPrice: number;                                      // pricePerHour × quantity × durationHours
  status: RentalStatus;
  cancelledAt: string | null;
  createdAt: string;
  gpu: GpuSummary;
}

export interface CreateRentalRequest {                     // body de POST /rentals (le prix n'est jamais envoyé)
  gpuId: number;
  quantity: number;
  startDate: string;                                       // date ISO, dans le futur
  durationHours: number;                                   // de 1 à 720
}

export interface RentalResponse {                          // réponse de POST /rentals et PATCH /rentals/:id/cancel
  rental: Rental;
}

export interface RentalListResponse {                      // réponse de GET /rentals/me
  rentals: Rental[];
  total: number;
}
