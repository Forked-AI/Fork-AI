import type { FeedbackLifecycleState } from "@/lib/feedback/lifecycle";

export const FEEDBACK_QUEUE_NAME = "feedback-processing";

export type FeedbackJobName = "redact-feedback" | "export-feedback-eval-case";

export interface FeedbackJobData {
	feedbackId: string;
	targetState?: FeedbackLifecycleState;
}

export async function enqueueFeedbackProcessing(_job: {
	name: FeedbackJobName;
	data: FeedbackJobData;
}) {
	// The repo's queue workers are optional in local/dev. This helper keeps the
	// route integration stable and can be swapped to BullMQ without changing API
	// callers when the worker is deployed.
	return { queued: false as const };
}
