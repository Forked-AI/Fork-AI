CREATE TYPE "SkillVisibility" AS ENUM (
  'private',
  'unlisted',
  'public',
  'org'
);

CREATE TYPE "SkillListingStatus" AS ENUM (
  'draft',
  'submitted',
  'listed',
  'limited',
  'removed',
  'deprecated'
);

CREATE TYPE "SkillPackageKind" AS ENUM (
  'skill',
  'config_pack',
  'setup'
);

CREATE TABLE "skill_template" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" "SkillPackageKind" NOT NULL DEFAULT 'skill',
  "visibility" "SkillVisibility" NOT NULL DEFAULT 'private',
  "status" "SkillListingStatus" NOT NULL DEFAULT 'draft',
  "category" TEXT NOT NULL,
  "tags" TEXT[],
  "currentVersionId" TEXT,
  "riskLevel" "ToolRiskLevel" NOT NULL DEFAULT 'low',
  "installCount" INTEGER NOT NULL DEFAULT 0,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "forkCount" INTEGER NOT NULL DEFAULT 0,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "skill_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skill_template_version" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "semver" TEXT,
  "manifestJson" JSONB NOT NULL,
  "instructionsHash" TEXT NOT NULL,
  "changelog" TEXT NOT NULL DEFAULT '',
  "requiredTools" TEXT[],
  "riskLevel" "ToolRiskLevel" NOT NULL DEFAULT 'low',
  "reviewStatus" TEXT NOT NULL DEFAULT 'private',
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "skill_template_version_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skill_collection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "skill_collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skill_collection_item" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "installedSkillId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "skill_collection_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_template_ownerId_slug_key"
  ON "skill_template"("ownerId", "slug");

CREATE INDEX "skill_template_ownerId_createdAt_idx"
  ON "skill_template"("ownerId", "createdAt");

CREATE INDEX "skill_template_visibility_status_category_idx"
  ON "skill_template"("visibility", "status", "category");

CREATE UNIQUE INDEX "skill_template_version_templateId_version_key"
  ON "skill_template_version"("templateId", "version");

CREATE INDEX "skill_template_version_templateId_createdAt_idx"
  ON "skill_template_version"("templateId", "createdAt");

CREATE INDEX "skill_template_version_reviewStatus_createdAt_idx"
  ON "skill_template_version"("reviewStatus", "createdAt");

CREATE UNIQUE INDEX "skill_collection_userId_name_key"
  ON "skill_collection"("userId", "name");

CREATE INDEX "skill_collection_userId_createdAt_idx"
  ON "skill_collection"("userId", "createdAt");

CREATE UNIQUE INDEX "skill_collection_item_collectionId_installedSkillId_key"
  ON "skill_collection_item"("collectionId", "installedSkillId");

CREATE INDEX "skill_collection_item_installedSkillId_idx"
  ON "skill_collection_item"("installedSkillId");

ALTER TABLE "skill_template"
  ADD CONSTRAINT "skill_template_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_template_version"
  ADD CONSTRAINT "skill_template_version_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "skill_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_template_version"
  ADD CONSTRAINT "skill_template_version_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_collection"
  ADD CONSTRAINT "skill_collection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_collection_item"
  ADD CONSTRAINT "skill_collection_item_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "skill_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_collection_item"
  ADD CONSTRAINT "skill_collection_item_installedSkillId_fkey"
  FOREIGN KEY ("installedSkillId") REFERENCES "installed_skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
