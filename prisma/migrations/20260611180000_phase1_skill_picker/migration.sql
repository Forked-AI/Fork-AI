CREATE TYPE "SkillBindingScope" AS ENUM (
  'turn',
  'conversation',
  'account_default'
);

ALTER TABLE "message"
  ADD COLUMN "activeSkillTraceJson" JSONB,
  ADD COLUMN "promptSkillHash" TEXT;

ALTER TABLE "generation"
  ADD COLUMN "activeSkillTraceJson" JSONB,
  ADD COLUMN "promptSkillHash" TEXT;

CREATE TABLE "installed_skill" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "alias" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "defaultScope" "SkillBindingScope",
  "settingsJson" JSONB,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),

  CONSTRAINT "installed_skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_skill_binding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT,
  "messageId" TEXT,
  "installedSkillId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "scope" "SkillBindingScope" NOT NULL,
  "renderHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),

  CONSTRAINT "conversation_skill_binding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "installed_skill_userId_templateId_versionId_key"
  ON "installed_skill"("userId", "templateId", "versionId");

CREATE INDEX "installed_skill_userId_pinned_installedAt_idx"
  ON "installed_skill"("userId", "pinned", "installedAt");

CREATE INDEX "installed_skill_templateId_versionId_idx"
  ON "installed_skill"("templateId", "versionId");

CREATE INDEX "conversation_skill_binding_userId_conversationId_scope_idx"
  ON "conversation_skill_binding"("userId", "conversationId", "scope");

CREATE INDEX "conversation_skill_binding_messageId_idx"
  ON "conversation_skill_binding"("messageId");

CREATE INDEX "conversation_skill_binding_installedSkillId_createdAt_idx"
  ON "conversation_skill_binding"("installedSkillId", "createdAt");

ALTER TABLE "installed_skill"
  ADD CONSTRAINT "installed_skill_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_skill_binding"
  ADD CONSTRAINT "conversation_skill_binding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_skill_binding"
  ADD CONSTRAINT "conversation_skill_binding_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_skill_binding"
  ADD CONSTRAINT "conversation_skill_binding_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversation_skill_binding"
  ADD CONSTRAINT "conversation_skill_binding_installedSkillId_fkey"
  FOREIGN KEY ("installedSkillId") REFERENCES "installed_skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
