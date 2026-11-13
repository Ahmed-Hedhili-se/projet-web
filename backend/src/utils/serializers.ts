import { Gpu, Prisma, User } from '@prisma/client';

export function toPrice(value: Prisma.Decimal | number): number { // Decimal Prisma → nombre à 2 décimales
  return Math.round(Number(value) * 100) / 100;
}

export function toGpu(gpu: Gpu, availableUnits: number) {   // objet "Gpu" de API.md
  return {
    id: gpu.id,
    name: gpu.name,
    manufacturer: gpu.manufacturer,
    architecture: gpu.architecture,
    vramGb: gpu.vramGb,
    fp16Tflops: gpu.fp16Tflops,
    pricePerHour: toPrice(gpu.pricePerHour),
    totalUnits: gpu.totalUnits,
    availableUnits,                                         // unités libres sur la période demandée
    description: gpu.description,
    isActive: gpu.isActive,
    createdAt: gpu.createdAt.toISOString(),
    updatedAt: gpu.updatedAt.toISOString(),
  };
}

export function toGpuSummary(gpu: Gpu) {                    // objet "GpuSummary" de API.md
  return {
    id: gpu.id,
    name: gpu.name,
    manufacturer: gpu.manufacturer,
    vramGb: gpu.vramGb,
    pricePerHour: toPrice(gpu.pricePerHour),
  };
}

export function toPublicUser(user: User) {                  // objet "User" de API.md : jamais de passwordHash
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
  };
}
