-- Phase 6 moderation and abuse controls.
CREATE TYPE "ModerationAction" AS ENUM ('allow', 'block', 'review', 'degrade');
CREATE TYPE "ModerationCategory" AS ENUM (
  'none',
  'child_safety',
  'violence',
  'self_harm',
  'sexual_content',
  'hate_harassment',
  'illegal_activity',
  'malware',
  'credential_exfiltration',
  'prompt_injection',
  'privacy_spam',
  'file_risk',
  'provider_abuse',
  'signup_abuse',
  'output_risk'
);
CREATE TYPE "ModerationSource" AS ENUM (
  'chat_message',
  'file_upload',
  'assistant_output',
  'share_snapshot',
  'account_export',
  'signup',
  'rate_limit',
  'provider_response'
);
CREATE TYPE "ModerationStage" AS ENUM (
  'pre_generation',
  'file_upload',
  'post_generation',
  'share_create',
  'account_export',
  'abuse_signal'
);
CREATE TYPE "ModerationSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "AbuseSignalType" AS ENUM (
  'prompt_flooding',
  'token_draining',
  'provider_rate_limit',
  'high_failure_rate',
  'suspicious_signup',
  'moderation_block',
  'rate_limit_exceeded',
  'file_scanner_block'
);

CREATE TABLE "moderation_event" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "organizationId" TEXT,
  "conversationId" TEXT,
  "messageId" TEXT,
  "fileObjectId" TEXT,
  "sharedConversationId" TEXT,
  "source" "ModerationSource" NOT NULL,
  "stage" "ModerationStage" NOT NULL,
  "category" "ModerationCategory" NOT NULL,
  "action" "ModerationAction" NOT NULL,
  "severity" "ModerationSeverity" NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "contentHash" TEXT,
  "contentLength" INTEGER,
  "matchedRuleIds" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "moderation_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "abuse_signal" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "organizationId" TEXT,
  "conversationId" TEXT,
  "signalType" "AbuseSignalType" NOT NULL,
  "severity" "ModerationSeverity" NOT NULL,
  "action" "ModerationAction" NOT NULL,
  "actorHash" TEXT,
  "count" INTEGER NOT NULL DEFAULT 1,
  "windowSeconds" INTEGER,
  "provider" TEXT,
  "model" TEXT,
  "providerStatusCode" INTEGER,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "abuse_signal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "moderation_event_userId_createdAt_idx" ON "moderation_event"("userId", "createdAt");
CREATE INDEX "moderation_event_conversationId_createdAt_idx" ON "moderation_event"("conversationId", "createdAt");
CREATE INDEX "moderation_event_messageId_createdAt_idx" ON "moderation_event"("messageId", "createdAt");
CREATE INDEX "moderation_event_fileObjectId_createdAt_idx" ON "moderation_event"("fileObjectId", "createdAt");
CREATE INDEX "moderation_event_sharedConversationId_createdAt_idx" ON "moderation_event"("sharedConversationId", "createdAt");
CREATE INDEX "moderation_event_source_stage_createdAt_idx" ON "moderation_event"("source", "stage", "createdAt");
CREATE INDEX "moderation_event_category_action_createdAt_idx" ON "moderation_event"("category", "action", "createdAt");

CREATE INDEX "abuse_signal_userId_createdAt_idx" ON "abuse_signal"("userId", "createdAt");
CREATE INDEX "abuse_signal_conversationId_createdAt_idx" ON "abuse_signal"("conversationId", "createdAt");
CREATE INDEX "abuse_signal_signalType_createdAt_idx" ON "abuse_signal"("signalType", "createdAt");
CREATE INDEX "abuse_signal_actorHash_createdAt_idx" ON "abuse_signal"("actorHash", "createdAt");

ALTER TABLE "moderation_event"
  ADD CONSTRAINT "moderation_event_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "moderation_event"
  ADD CONSTRAINT "moderation_event_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "moderation_event"
  ADD CONSTRAINT "moderation_event_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "moderation_event"
  ADD CONSTRAINT "moderation_event_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "file_object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "moderation_event"
  ADD CONSTRAINT "moderation_event_sharedConversationId_fkey"
  FOREIGN KEY ("sharedConversationId") REFERENCES "shared_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "abuse_signal"
  ADD CONSTRAINT "abuse_signal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "abuse_signal"
  ADD CONSTRAINT "abuse_signal_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
