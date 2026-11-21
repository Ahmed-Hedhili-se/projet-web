export interface Gpu {
  id: number;
  name: string;
  manufacturer: string;
  architecture: string;
  vramGb: number;
  fp16Tflops: number;
  pricePerHour: number;
  totalUnits: number;
  availableUnits: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GpuSort = 'price_asc' | 'price_desc' | 'vram_desc' | 'name_asc';

export interface GpuQuery {
  search?: string;
  manufacturer?: string;
  minVram?: number;
  maxPrice?: number;
  available?: boolean;
  startDate?: string;
  durationHours?: number;
  sort?: GpuSort;
}

export interface GpuListResponse {
  gpus: Gpu[];
  total: number;
  manufacturers: string[];
}

export interface GpuResponse {
  gpu: Gpu;
}

export interface GpuSummary {
  id: number;
  name: string;
  manufacturer: string;
  vramGb: number;
  pricePerHour: number;
}

export function toGpuSummary(gpu: Gpu): GpuSummary {
  return {
    id: gpu.id,
    name: gpu.name,
    manufacturer: gpu.manufacturer,
    vramGb: gpu.vramGb,
    pricePerHour: gpu.pricePerHour,
  };
}
