import { buildFeedbackEvalCase } from "@/lib/feedback/eval-export";
import {
	initialFeedbackLifecycleState,
	type FeedbackCorrection,
} from "@/lib/feedback/lifecycle";
import {
	redactFeedbackCorrection,
	redactFeedbackText,
} from "@/lib/feedback/redaction";
import { describe, expect, it } from "vitest";

describe("feedback lifecycle", () => {
	it("requires redaction when comments or corrections contain text", () => {
		const correction: FeedbackCorrection = {
			correctedAnswer: "Use a 30 day refund window.",
			correctSourceChunkId: "chunk-refund",
			missingSource: "",
			expectedBehavior: "",
		};

		expect(
			initialFeedbackLifecycleState({
				type: "bad",
				reasons: ["unsupported_by_source"],
				comment: "Wrong source",
				correction,
			})
		).toBe("redaction_needed");
	});

	it("redacts likely private identifiers", () => {
		expect(
			redactFeedbackText("Email owner@example.com with sk-secret-token")
		).toMatchObject({
			redacted: "Email [redacted-email] with [redacted-token]",
			replacementCount: 2,
		});

		expect(
			redactFeedbackCorrection({
				correctedAnswer: "Call 4111 1111 1111 1111",
				correctSourceChunkId: "",
				missingSource: "",
				expectedBehavior: "",
			}).redacted.correctedAnswer
		).toBe("Call [redacted-number]");
	});

	it("builds feedback-derived eval cases from redacted content", () => {
		const evalCase = buildFeedbackEvalCase({
			id: "feedback-1",
			messageId: "message-1",
			reasons: ["missing_source"],
			redactedComment: "Needs source.",
			redactedCorrection: {
				correctedAnswer: "Use the policy source.",
				correctSourceChunkId: "chunk-policy",
				missingSource: "",
				expectedBehavior: "",
			},
			provenance: { source: "chat_feedback" },
		});

		expect(evalCase).toMatchObject({
			id: "feedback-feedback-1",
			source: "feedback-derived",
			assertions: {
				requiredSubstrings: ["Use the policy source."],
			},
		});
	});
});
