import { ContactMessage } from './contact';
import { Gpu } from './gpu';
import { Rental } from './rental';
import { Role, User } from './user';

export interface AdminStats {
  users: { total: number; admins: number; blocked: number };
  gpus: { total: number; active: number; totalUnits: number };
  rentals: { total: number; upcoming: number; active: number; completed: number; cancelled: number };
  revenue: { total: number; last30Days: number };
  messages: { total: number; unread: number };
  topGpus: { gpuId: number; name: string; rentalCount: number; revenue: number }[];
  rentalsPerMonth: { month: string; count: number; revenue: number }[];
}

export interface AdminGpu extends Gpu {
  rentalCount: number;
}

export interface AdminGpuListResponse {
  gpus: AdminGpu[];
  total: number;
}

export interface GpuInput {
  name: string;
  manufacturer: string;
  architecture: string;
  vramGb: number;
  fp16Tflops: number;
  pricePerHour: number;
  totalUnits: number;
  description: string;
  isActive: boolean;
}

export interface AdminUser extends User {
  rentalCount: number;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
}

export interface UserChanges {
  role?: Role;
  isBlocked?: boolean;
}

export interface AdminRental extends Rental {
  user: { id: number; email: string; firstName: string; lastName: string };
}

export interface AdminRentalListResponse {
  rentals: AdminRental[];
  total: number;
}

export interface AdminMessageListResponse {
  messages: ContactMessage[];
  total: number;
  unread: number;
}
