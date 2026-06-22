import { createHash } from "node:crypto";
import { z } from "zod";

export const FEEDBACK_LIFECYCLE_STATES = [
	"raw_feedback",
	"redaction_needed",
	"redacted",
	"needs_reviewer",
	"labeled",
	"accepted_to_eval",
	"rejected_privacy",
	"rejected_low_signal",
] as const;

export const feedbackLifecycleStateSchema = z.enum(FEEDBACK_LIFECYCLE_STATES);

export type FeedbackLifecycleState = z.infer<
	typeof feedbackLifecycleStateSchema
>;

export const feedbackCorrectionSchema = z
	.object({
		correctedAnswer: z.string().trim().max(4_000).default(""),
		correctSourceChunkId: z.string().trim().max(200).default(""),
		missingSource: z.string().trim().max(500).default(""),
		expectedBehavior: z.string().trim().max(1_000).default(""),
	})
	.default({});

export type FeedbackCorrection = z.infer<typeof feedbackCorrectionSchema>;

export function initialFeedbackLifecycleState(input: {
	type: "good" | "bad";
	reasons: string[];
	comment: string;
	correction: FeedbackCorrection;
}): FeedbackLifecycleState {
	const hasPrivateText =
		input.comment.length > 0 ||
		input.correction.correctedAnswer.length > 0 ||
		input.correction.missingSource.length > 0 ||
		input.correction.expectedBehavior.length > 0;
	if (hasPrivateText) return "redaction_needed";
	if (input.type === "bad" && input.reasons.length > 0) {
		return "needs_reviewer";
	}
	return "raw_feedback";
}

export function feedbackContentHash(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

export function buildFeedbackProvenance(input: {
	messageId: string;
	userId: string;
	reasons: string[];
	source: "chat_feedback";
}) {
	return {
		source: input.source,
		messageId: input.messageId,
		userHash: feedbackContentHash(input.userId).slice(0, 24),
		reasons: input.reasons,
		createdAt: new Date().toISOString(),
	};
}
