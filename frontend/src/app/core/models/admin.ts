import { Gpu } from './gpu';

export interface AdminStats {                              // réponse de GET /admin/stats (docs/API.md, section 9)
  users: { total: number; admins: number; blocked: number };
  gpus: { total: number; active: number; totalUnits: number };
  rentals: { total: number; upcoming: number; active: number; completed: number; cancelled: number };
  revenue: { total: number; last30Days: number };          // locations non annulées
  messages: { total: number; unread: number };
  topGpus: { gpuId: number; name: string; rentalCount: number; revenue: number }[]; // 5 maximum
  rentalsPerMonth: { month: string; count: number; revenue: number }[]; // 6 derniers mois, ex. "2026-10"
}

export interface AdminGpu extends Gpu {                    // GPU vu par l'admin : + nombre total de locations
  rentalCount: number;
}

export interface AdminGpuListResponse {                    // réponse de GET /admin/gpus (actifs et désactivés)
  gpus: AdminGpu[];
  total: number;
}

export interface GpuInput {                                // body de POST /admin/gpus et PUT /admin/gpus/:id
  name: string;
  manufacturer: string;
  architecture: string;
  vramGb: number;
  fp16Tflops: number;
  pricePerHour: number;
  totalUnits: number;
  description: string;
  isActive: boolean;                                       // optionnel en POST (true par défaut), obligatoire en PUT
}
