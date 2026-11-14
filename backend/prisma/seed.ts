import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOPPER = ['FP64', 'FP32', 'TF32', 'BF16', 'FP16', 'FP8', 'INT8'];
const AMPERE = ['FP64', 'FP32', 'TF32', 'BF16', 'FP16', 'INT8'];
const ADA = ['FP32', 'TF32', 'BF16', 'FP16', 'FP8', 'INT8'];

const gpus = [
  {
    name: 'NVIDIA H100 80GB', manufacturer: 'NVIDIA', architecture: 'Hopper',
    vramGb: 80, fp16Tflops: 989.5, pricePerHour: 3.2, totalUnits: 8,
    description: 'Flagship data-center GPU for large-scale training and fast inference.',
    memoryBandwidthGbs: 3350, fp8Tflops: 1979, supportedPrecisions: HOPPER,
    softwareStack: 'CUDA' as const, computeCapability: '9.0', eccMemory: true, fastInterconnect: true,
  },
  {
    name: 'NVIDIA A100 80GB', manufacturer: 'NVIDIA', architecture: 'Ampere',
    vramGb: 80, fp16Tflops: 312, pricePerHour: 1.89, totalUnits: 12,
    description: 'Proven workhorse for training and fine-tuning large models.',
    memoryBandwidthGbs: 2039, fp8Tflops: null, supportedPrecisions: AMPERE,
    softwareStack: 'CUDA' as const, computeCapability: '8.0', eccMemory: true, fastInterconnect: true,
  },
  {
    name: 'NVIDIA A100 40GB', manufacturer: 'NVIDIA', architecture: 'Ampere',
    vramGb: 40, fp16Tflops: 312, pricePerHour: 1.29, totalUnits: 10,
    description: 'Balanced choice for mid-size training jobs and high-throughput inference.',
    memoryBandwidthGbs: 1555, fp8Tflops: null, supportedPrecisions: AMPERE,
    softwareStack: 'CUDA' as const, computeCapability: '8.0', eccMemory: true, fastInterconnect: false,
  },
  {
    name: 'AMD Instinct MI300X', manufacturer: 'AMD', architecture: 'CDNA 3',
    vramGb: 192, fp16Tflops: 1307.4, pricePerHour: 3.49, totalUnits: 4,
    description: 'Massive 192 GB of memory to run the largest models on a single GPU.',
    memoryBandwidthGbs: 5300, fp8Tflops: 2614.9, supportedPrecisions: HOPPER,
    softwareStack: 'ROCM' as const, computeCapability: 'gfx942', eccMemory: true, fastInterconnect: true,
  },
  {
    name: 'NVIDIA RTX 4090', manufacturer: 'NVIDIA', architecture: 'Ada Lovelace',
    vramGb: 24, fp16Tflops: 165, pricePerHour: 0.69, totalUnits: 16,
    description: 'Cost-effective GPU for inference, prototyping and small fine-tuning jobs.',
    memoryBandwidthGbs: 1008, fp8Tflops: 330, supportedPrecisions: ADA,
    softwareStack: 'CUDA' as const, computeCapability: '8.9', eccMemory: false, fastInterconnect: false,
  },
  {
    name: 'NVIDIA L4', manufacturer: 'NVIDIA', architecture: 'Ada Lovelace',
    vramGb: 24, fp16Tflops: 121, pricePerHour: 0.79, totalUnits: 6,
    description: 'Energy-efficient GPU for video, vision and lightweight inference workloads.',
    memoryBandwidthGbs: 300, fp8Tflops: 242, supportedPrecisions: ADA,
    softwareStack: 'CUDA' as const, computeCapability: '8.9', eccMemory: true, fastInterconnect: false,
  },
  {
    name: 'NVIDIA V100 32GB', manufacturer: 'NVIDIA', architecture: 'Volta',
    vramGb: 32, fp16Tflops: 125, pricePerHour: 0.89, totalUnits: 4,
    description: 'Previous-generation GPU, retired from the catalog.',
    isActive: false,
    memoryBandwidthGbs: 900, fp8Tflops: null, supportedPrecisions: ['FP64', 'FP32', 'FP16', 'INT8'],
    softwareStack: 'CUDA' as const, computeCapability: '7.0', eccMemory: true, fastInterconnect: true,
  },
];

async function main() {
  for (const gpu of gpus) {
    await prisma.gpu.upsert({
      where: { name: gpu.name },
      update: gpu,
      create: gpu,
    });
  }
  console.log(`Seeded ${gpus.length} GPUs.`);

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL or ADMIN_PASSWORD missing: admin account not created.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, role: 'ADMIN', isBlocked: false },
    create: { email: email.toLowerCase(), passwordHash, firstName: 'Admin', lastName: 'NeuroGrid', role: 'ADMIN' },
  });
  console.log(`Admin account ready: ${email.toLowerCase()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
