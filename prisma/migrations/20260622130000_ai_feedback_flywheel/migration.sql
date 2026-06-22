-- Add privacy-safe feedback lifecycle fields for AI eval flywheel review/export.
ALTER TABLE "message_feedback"
	ADD COLUMN "correctionJson" JSONB,
	ADD COLUMN "lifecycleState" TEXT NOT NULL DEFAULT 'raw_feedback',
	ADD COLUMN "redactedComment" TEXT,
	ADD COLUMN "redactedCorrectionJson" JSONB,
	ADD COLUMN "evalCaseJson" JSONB,
	ADD COLUMN "provenanceJson" JSONB,
	ADD COLUMN "reviewedBy" TEXT,
	ADD COLUMN "reviewedAt" TIMESTAMP(3),
	ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "message_feedback_lifecycleState_createdAt_idx"
	ON "message_feedback"("lifecycleState", "createdAt");
