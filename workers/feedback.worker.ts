import { Prisma } from "@/generated/prisma/client";
import { buildFeedbackEvalCase } from "@/lib/feedback/eval-export";
import {
	feedbackLifecycleStateSchema,
	type FeedbackCorrection,
} from "@/lib/feedback/lifecycle";
import {
	redactFeedbackCorrection,
	redactFeedbackText,
} from "@/lib/feedback/redaction";
import { prisma } from "@/lib/prisma";

type FeedbackPrismaClient = typeof prisma;

export async function processFeedbackRedaction(
	feedbackId: string,
	prismaClient: FeedbackPrismaClient = prisma
) {
	const feedback = await prismaClient.messageFeedback.findUnique({
		where: { id: feedbackId },
	});
	if (!feedback) return null;

	const comment = redactFeedbackText(feedback.comment ?? "");
	const correction = redactFeedbackCorrection(
		((feedback.correctionJson as FeedbackCorrection | null) ?? {
			correctedAnswer: "",
			correctSourceChunkId: "",
			missingSource: "",
			expectedBehavior: "",
		}) as FeedbackCorrection
	);
	const lifecycleState =
		comment.replacementCount + correction.replacementCount > 0
			? "needs_reviewer"
			: "redacted";

	return prismaClient.messageFeedback.update({
		where: { id: feedbackId },
		data: {
			redactedComment: comment.redacted,
			redactedCorrectionJson: correction.redacted,
			lifecycleState,
		},
	});
}

export async function processFeedbackEvalExport(
	feedbackId: string,
	prismaClient: FeedbackPrismaClient = prisma
) {
	const feedback = await prismaClient.messageFeedback.findUnique({
		where: { id: feedbackId },
	});
	if (!feedback) return null;

	const state = feedbackLifecycleStateSchema.parse(feedback.lifecycleState);
	if (state !== "labeled" && state !== "accepted_to_eval") {
		throw new Error("Feedback must be labeled before eval export");
	}

	const evalCase = buildFeedbackEvalCase({
		id: feedback.id,
		messageId: feedback.messageId,
		reasons: feedback.reasons,
		redactedComment: feedback.redactedComment ?? "",
		redactedCorrection:
			(feedback.redactedCorrectionJson as FeedbackCorrection | null) ??
			({
				correctedAnswer: "",
				correctSourceChunkId: "",
				missingSource: "",
				expectedBehavior: "",
			} satisfies FeedbackCorrection),
		provenance: (feedback.provenanceJson as Record<string, unknown>) ?? {},
	});

	return prismaClient.messageFeedback.update({
		where: { id: feedbackId },
		data: {
			evalCaseJson: JSON.parse(
				JSON.stringify(evalCase)
			) as Prisma.InputJsonValue,
			lifecycleState: "accepted_to_eval",
		},
	});
}
