import { ContactMessage } from './contact';
import { Gpu } from './gpu';
import { Rental } from './rental';
import { Role, User } from './user';

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

export interface AdminUser extends User {                  // utilisateur vu par l'admin : + nombre de locations
  rentalCount: number;
}

export interface AdminUserListResponse {                   // réponse de GET /admin/users
  users: AdminUser[];
  total: number;
}

export interface UserChanges {                             // body de PATCH /admin/users/:id (au moins un des deux champs)
  role?: Role;
  isBlocked?: boolean;
}

export interface AdminRental extends Rental {              // objet « AdminRental » de docs/API.md : une location + son utilisateur
  user: { id: number; email: string; firstName: string; lastName: string };
}

export interface AdminRentalListResponse {                 // réponse de GET /admin/rentals
  rentals: AdminRental[];
  total: number;
}

export interface AdminMessageListResponse {                // réponse de GET /admin/messages
  messages: ContactMessage[];
  total: number;
  unread: number;                                          // nombre total de non lus (indépendant du filtre)
}
