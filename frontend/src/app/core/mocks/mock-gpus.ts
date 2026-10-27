import { Gpu } from '../models/gpu';

const created = '2026-10-01T08:00:00.000Z';                // même date de création pour tous les exemples

export const MOCK_GPUS: Gpu[] = [                          // données fictives au format de docs/API.md (ids cohérents avec ses exemples)
  {
    id: 1, name: 'NVIDIA H100 80GB', manufacturer: 'NVIDIA', architecture: 'Hopper',
    vramGb: 80, fp16Tflops: 989.5, pricePerHour: 3.2, totalUnits: 8, availableUnits: 6,
    description: 'Flagship data-center GPU for large-scale training and fast inference.',
    isActive: true, createdAt: created, updatedAt: created,
  },
  {
    id: 2, name: 'NVIDIA A100 80GB', manufacturer: 'NVIDIA', architecture: 'Ampere',
    vramGb: 80, fp16Tflops: 312, pricePerHour: 1.89, totalUnits: 12, availableUnits: 9,
    description: 'Proven workhorse for training and fine-tuning large models.',
    isActive: true, createdAt: created, updatedAt: created,
  },
  {
    id: 3, name: 'NVIDIA A100 40GB', manufacturer: 'NVIDIA', architecture: 'Ampere',
    vramGb: 40, fp16Tflops: 312, pricePerHour: 1.29, totalUnits: 10, availableUnits: 4,
    description: 'Balanced choice for mid-size training jobs and high-throughput inference.',
    isActive: true, createdAt: created, updatedAt: created,
  },
  {
    id: 4, name: 'AMD Instinct MI300X', manufacturer: 'AMD', architecture: 'CDNA 3',
    vramGb: 192, fp16Tflops: 1307.4, pricePerHour: 3.49, totalUnits: 4, availableUnits: 0,
    description: 'Massive 192 GB of memory to run the largest models on a single GPU.',
    isActive: true, createdAt: created, updatedAt: created,
  },
  {
    id: 5, name: 'NVIDIA RTX 4090', manufacturer: 'NVIDIA', architecture: 'Ada Lovelace',
    vramGb: 24, fp16Tflops: 165, pricePerHour: 0.69, totalUnits: 16, availableUnits: 11,
    description: 'Cost-effective GPU for inference, prototyping and small fine-tuning jobs.',
    isActive: true, createdAt: created, updatedAt: created,
  },
  {
    id: 6, name: 'NVIDIA L4', manufacturer: 'NVIDIA', architecture: 'Ada Lovelace',
    vramGb: 24, fp16Tflops: 121, pricePerHour: 0.79, totalUnits: 6, availableUnits: 6,
    description: 'Energy-efficient GPU for video, vision and lightweight inference workloads.',
    isActive: true, createdAt: created, updatedAt: created,
  },
  {
    id: 7, name: 'NVIDIA V100 32GB', manufacturer: 'NVIDIA', architecture: 'Volta',
    vramGb: 32, fp16Tflops: 125, pricePerHour: 0.89, totalUnits: 4, availableUnits: 4,
    description: 'Previous-generation GPU, retired from the catalog.',
    isActive: false, createdAt: created, updatedAt: created, // désactivé : ne doit pas apparaître dans le catalogue
  },
];
