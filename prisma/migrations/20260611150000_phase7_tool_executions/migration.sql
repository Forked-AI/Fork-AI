CREATE TYPE "ToolRiskLevel" AS ENUM ('low', 'medium', 'high');

CREATE TYPE "ToolExecutionStatus" AS ENUM (
  'pending_confirmation',
  'cancelled',
  'running',
  'succeeded',
  'failed',
  'unauthorized',
  'invalid_input',
  'timed_out'
);

CREATE TABLE "tool_execution" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "conversationId" TEXT,
  "messageId" TEXT,
  "toolName" TEXT NOT NULL,
  "status" "ToolExecutionStatus" NOT NULL,
  "riskLevel" "ToolRiskLevel" NOT NULL,
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt" TIMESTAMP(3),
  "inputSummaryJson" JSONB,
  "resultSummaryJson" JSONB,
  "auditMetadata" JSONB,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tool_execution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tool_execution_userId_createdAt_idx" ON "tool_execution"("userId", "createdAt");
CREATE INDEX "tool_execution_conversationId_createdAt_idx" ON "tool_execution"("conversationId", "createdAt");
CREATE INDEX "tool_execution_messageId_createdAt_idx" ON "tool_execution"("messageId", "createdAt");
CREATE INDEX "tool_execution_toolName_createdAt_idx" ON "tool_execution"("toolName", "createdAt");
CREATE INDEX "tool_execution_status_createdAt_idx" ON "tool_execution"("status", "createdAt");

ALTER TABLE "tool_execution"
  ADD CONSTRAINT "tool_execution_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool_execution"
  ADD CONSTRAINT "tool_execution_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tool_execution"
  ADD CONSTRAINT "tool_execution_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
