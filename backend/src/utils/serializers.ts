import { AgentConversation, AgentMessage, Gpu, Prisma, User } from '@prisma/client';

export function toConversation(conversation: AgentConversation & { _count: { messages: number } }) {
  return {
    id: conversation.id,
    title: conversation.title,
    repoUrl: conversation.repoUrl,
    messageCount: conversation._count.messages,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function toAgentMessage(message: AgentMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    steps: message.steps,
    cards: message.cards,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toPrice(value: Prisma.Decimal | number): number {
  return Math.round(Number(value) * 100) / 100;
}

export function toGpu(gpu: Gpu, availableUnits: number) {
  return {
    id: gpu.id,
    name: gpu.name,
    manufacturer: gpu.manufacturer,
    architecture: gpu.architecture,
    vramGb: gpu.vramGb,
    fp16Tflops: gpu.fp16Tflops,
    pricePerHour: toPrice(gpu.pricePerHour),
    totalUnits: gpu.totalUnits,
    availableUnits,
    description: gpu.description,
    isActive: gpu.isActive,
    createdAt: gpu.createdAt.toISOString(),
    updatedAt: gpu.updatedAt.toISOString(),
  };
}

export function toGpuSummary(gpu: Gpu) {
  return {
    id: gpu.id,
    name: gpu.name,
    manufacturer: gpu.manufacturer,
    vramGb: gpu.vramGb,
    pricePerHour: toPrice(gpu.pricePerHour),
  };
}

export function toPublicUser(user: User) {
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
