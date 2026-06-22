import type { FeedbackCorrection } from "@/lib/feedback/lifecycle";

export interface FeedbackEvalCaseInput {
	id: string;
	messageId: string;
	reasons: string[];
	redactedComment: string;
	redactedCorrection: FeedbackCorrection;
	provenance: Record<string, unknown>;
}

export function buildFeedbackEvalCase(input: FeedbackEvalCaseInput) {
	const expected =
		input.redactedCorrection.correctedAnswer ||
		input.redactedCorrection.expectedBehavior ||
		input.redactedComment;

	return {
		id: `feedback-${input.id}`,
		taskId: "chat.general",
		description: "Feedback-derived correction case",
		source: "feedback-derived",
		provenance: input.provenance,
		input: {
			messageId: input.messageId,
			reasons: input.reasons,
		},
		mockResponse: {
			text: expected || "The assistant should correct the prior answer.",
		},
		assertions: {
			requiredSubstrings: expected ? [expected.slice(0, 120)] : [],
			forbiddenSubstrings: [],
		},
	};
}

export function toJsonl(records: unknown[]) {
	return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
}
