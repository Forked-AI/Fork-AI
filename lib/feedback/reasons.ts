export const FEEDBACK_REASONS = [
	{ id: "incorrect", label: "Incorrect" },
	{ id: "unsupported_by_source", label: "Unsupported by source" },
	{ id: "wrong_source", label: "Wrong source" },
	{ id: "missing_source", label: "Missing source" },
	{ id: "ignored_instruction", label: "Ignored instruction" },
	{ id: "unsafe", label: "Unsafe" },
	{ id: "too_slow", label: "Too slow" },
	{ id: "formatting", label: "Formatting" },
	{ id: "wrong_model", label: "Wrong model" },
	{ id: "other", label: "Other" },
] as const;

export type FeedbackReasonId = (typeof FEEDBACK_REASONS)[number]["id"];

export const FEEDBACK_REASON_IDS = FEEDBACK_REASONS.map(
	(reason) => reason.id
) as [FeedbackReasonId, ...FeedbackReasonId[]];

export function isFeedbackReasonId(value: unknown): value is FeedbackReasonId {
	return (
		typeof value === "string" &&
		FEEDBACK_REASONS.some((reason) => reason.id === value)
	);
}
