CREATE TYPE "MarketplacePostType" AS ENUM (
  'result',
  'skill',
  'config',
  'setup',
  'case_study'
);

CREATE TYPE "MarketplacePostVisibility" AS ENUM (
  'draft',
  'unlisted',
  'public'
);

CREATE TYPE "MarketplacePostStatus" AS ENUM (
  'draft',
  'listed',
  'blocked',
  'unpublished',
  'deleted'
);

CREATE TYPE "MarketplaceProvenanceType" AS ENUM (
  'skill',
  'config_pack',
  'setup',
  'model'
);

CREATE TYPE "MarketplaceEngagementType" AS ENUM (
  'like',
  'bookmark'
);

CREATE TABLE "marketplace_post" (
  "id" TEXT NOT NULL,
  "type" "MarketplacePostType" NOT NULL DEFAULT 'result',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "visibility" "MarketplacePostVisibility" NOT NULL DEFAULT 'draft',
  "status" "MarketplacePostStatus" NOT NULL DEFAULT 'draft',
  "creatorId" TEXT NOT NULL,
  "organizationId" TEXT,
  "sharedConversationId" TEXT NOT NULL,
  "sourceMessageId" TEXT,
  "moderationAction" "ModerationAction" NOT NULL DEFAULT 'allow',
  "moderationCategory" "ModerationCategory" NOT NULL DEFAULT 'none',
  "moderationSeverity" "ModerationSeverity" NOT NULL DEFAULT 'low',
  "moderationReason" TEXT NOT NULL DEFAULT '',
  "contentHash" TEXT,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "unlistedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marketplace_post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_post_provenance" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "type" "MarketplaceProvenanceType" NOT NULL,
  "templateId" TEXT,
  "versionId" TEXT,
  "installedSkillId" TEXT,
  "title" TEXT NOT NULL,
  "source" TEXT,
  "riskLevel" "ToolRiskLevel",
  "requiredTools" TEXT[],
  "renderHash" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketplace_post_provenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_post_engagement" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "MarketplaceEngagementType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketplace_post_engagement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketplace_post_creatorId_createdAt_idx"
  ON "marketplace_post"("creatorId", "createdAt");

CREATE INDEX "marketplace_post_organizationId_createdAt_idx"
  ON "marketplace_post"("organizationId", "createdAt");

CREATE INDEX "marketplace_post_visibility_status_createdAt_idx"
  ON "marketplace_post"("visibility", "status", "createdAt");

CREATE INDEX "marketplace_post_sharedConversationId_idx"
  ON "marketplace_post"("sharedConversationId");

CREATE INDEX "marketplace_post_sourceMessageId_idx"
  ON "marketplace_post"("sourceMessageId");

CREATE INDEX "marketplace_post_provenance_postId_idx"
  ON "marketplace_post_provenance"("postId");

CREATE INDEX "marketplace_post_provenance_type_templateId_versionId_idx"
  ON "marketplace_post_provenance"("type", "templateId", "versionId");

CREATE UNIQUE INDEX "marketplace_post_engagement_postId_userId_type_key"
  ON "marketplace_post_engagement"("postId", "userId", "type");

CREATE INDEX "marketplace_post_engagement_userId_type_createdAt_idx"
  ON "marketplace_post_engagement"("userId", "type", "createdAt");

CREATE INDEX "marketplace_post_engagement_postId_type_idx"
  ON "marketplace_post_engagement"("postId", "type");

ALTER TABLE "marketplace_post"
  ADD CONSTRAINT "marketplace_post_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_post"
  ADD CONSTRAINT "marketplace_post_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_post"
  ADD CONSTRAINT "marketplace_post_sharedConversationId_fkey"
  FOREIGN KEY ("sharedConversationId") REFERENCES "shared_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_post"
  ADD CONSTRAINT "marketplace_post_sourceMessageId_fkey"
  FOREIGN KEY ("sourceMessageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "marketplace_post_provenance"
  ADD CONSTRAINT "marketplace_post_provenance_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "marketplace_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_post_engagement"
  ADD CONSTRAINT "marketplace_post_engagement_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "marketplace_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_post_engagement"
  ADD CONSTRAINT "marketplace_post_engagement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
