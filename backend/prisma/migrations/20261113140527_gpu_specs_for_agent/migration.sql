-- CreateEnum
CREATE TYPE "SoftwareStack" AS ENUM ('CUDA', 'ROCM');

-- AlterTable
ALTER TABLE "gpus" ADD COLUMN     "computeCapability" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "eccMemory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fastInterconnect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fp8Tflops" DOUBLE PRECISION,
ADD COLUMN     "memoryBandwidthGbs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "softwareStack" "SoftwareStack" NOT NULL DEFAULT 'CUDA',
ADD COLUMN     "supportedPrecisions" TEXT[] DEFAULT ARRAY[]::TEXT[];
