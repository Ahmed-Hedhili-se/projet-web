-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "agent_conversations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "repoUrl" TEXT,
    "workloadProfile" JSONB NOT NULL DEFAULT '{}',
    "lastRanking" JSONB,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "role" "AgentRole" NOT NULL,
    "content" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "cards" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_conversations_userId_updatedAt_idx" ON "agent_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "agent_messages_conversationId_createdAt_idx" ON "agent_messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
