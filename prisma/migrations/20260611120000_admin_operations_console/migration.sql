-- Admin operations console: metadata-only operational metrics and admin audit trail.
CREATE TABLE "operational_metric" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "route" TEXT,
  "job" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "durationMs" INTEGER,
  "ttftMs" INTEGER,
  "tokensPerSec" DOUBLE PRECISION,
  "totalTokens" INTEGER,
  "costTotal" DOUBLE PRECISION,
  "errorCode" TEXT,
  "providerStatus" INTEGER,
  "userId" TEXT,
  "conversationId" TEXT,
  "traceId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "operational_metric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_event" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "requestId" TEXT,
  "idempotencyKey" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_metric_kind_source_createdAt_idx" ON "operational_metric"("kind", "source", "createdAt");
CREATE INDEX "operational_metric_status_createdAt_idx" ON "operational_metric"("status", "createdAt");
CREATE INDEX "operational_metric_route_createdAt_idx" ON "operational_metric"("route", "createdAt");
CREATE INDEX "operational_metric_job_createdAt_idx" ON "operational_metric"("job", "createdAt");
CREATE INDEX "operational_metric_provider_model_createdAt_idx" ON "operational_metric"("provider", "model", "createdAt");
CREATE INDEX "operational_metric_userId_createdAt_idx" ON "operational_metric"("userId", "createdAt");
CREATE INDEX "operational_metric_conversationId_createdAt_idx" ON "operational_metric"("conversationId", "createdAt");
CREATE INDEX "operational_metric_traceId_idx" ON "operational_metric"("traceId");

CREATE INDEX "admin_audit_event_actorId_createdAt_idx" ON "admin_audit_event"("actorId", "createdAt");
CREATE INDEX "admin_audit_event_action_createdAt_idx" ON "admin_audit_event"("action", "createdAt");
CREATE INDEX "admin_audit_event_targetType_targetId_createdAt_idx" ON "admin_audit_event"("targetType", "targetId", "createdAt");
CREATE INDEX "admin_audit_event_idempotencyKey_idx" ON "admin_audit_event"("idempotencyKey");

ALTER TABLE "admin_audit_event"
  ADD CONSTRAINT "admin_audit_event_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
