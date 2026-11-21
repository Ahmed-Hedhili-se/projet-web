export interface Gpu {
  // objet « Gpu » de docs/API.md
  id: number;
  name: string;
  manufacturer: string;
  architecture: string;
  vramGb: number;
  fp16Tflops: number;
  pricePerHour: number;
  totalUnits: number;
  availableUnits: number; // unités libres sur la période demandée
  description: string;
  isActive: boolean;
  createdAt: string; // date ISO 8601
  updatedAt: string;
}

export type GpuSort = 'price_asc' | 'price_desc' | 'vram_desc' | 'name_asc'; // valeurs possibles de « sort »

export interface GpuQuery {
  // paramètres de query de GET /gpus (tous optionnels)
  search?: string;
  manufacturer?: string;
  minVram?: number;
  maxPrice?: number;
  available?: boolean;
  startDate?: string; // date ISO, utilisée avec durationHours
  durationHours?: number;
  sort?: GpuSort;
}

export interface GpuListResponse {
  // réponse de GET /gpus
  gpus: Gpu[];
  total: number;
  manufacturers: string[];
}

export interface GpuResponse {
  // réponse de GET /gpus/:id
  gpu: Gpu;
}

export interface GpuSummary {
  // objet « GpuSummary » de docs/API.md (GPU résumé)
  id: number;
  name: string;
  manufacturer: string;
  vramGb: number;
  pricePerHour: number;
}

export function toGpuSummary(gpu: Gpu): GpuSummary {
  // Gpu complet → GpuSummary
  return {
    id: gpu.id,
    name: gpu.name,
    manufacturer: gpu.manufacturer,
    vramGb: gpu.vramGb,
    pricePerHour: gpu.pricePerHour,
  };
}
