import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_REASON_IDS } from "@/lib/feedback/reasons";
import {
	buildFeedbackProvenance,
	feedbackCorrectionSchema,
	initialFeedbackLifecycleState,
} from "@/lib/feedback/lifecycle";
import {
	redactFeedbackCorrection,
	redactFeedbackText,
} from "@/lib/feedback/redaction";
import { resolveWorkspaceContext } from "@/lib/organizations/context";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const feedbackSchema = z.object({
	messageId: z.string().min(1).max(200),
	type: z.enum(["good", "bad"]),
	reasons: z.array(z.enum(FEEDBACK_REASON_IDS)).max(10).default([]),
	comment: z.string().trim().max(4000).default(""),
	correction: z
		.union([z.string().trim().max(4000), feedbackCorrectionSchema])
		.default(""),
});

function normalizeCorrection(
	correction: z.infer<typeof feedbackSchema>["correction"]
) {
	if (typeof correction === "string") {
		return {
			correctedAnswer: correction,
			correctSourceChunkId: "",
			missingSource: "",
			expectedBehavior: "",
		};
	}
	return feedbackCorrectionSchema.parse(correction);
}

function formatFeedbackComment(input: {
	comment: string;
	correction: ReturnType<typeof normalizeCorrection>;
}) {
	const sections: string[] = [];
	if (input.correction.correctedAnswer) {
		sections.push(`Correction:\n${input.correction.correctedAnswer}`);
	}
	if (input.correction.correctSourceChunkId) {
		sections.push(
			`Correct source chunk:\n${input.correction.correctSourceChunkId}`
		);
	}
	if (input.correction.missingSource) {
		sections.push(`Missing source:\n${input.correction.missingSource}`);
	}
	if (input.correction.expectedBehavior) {
		sections.push(
			`Expected behavior:\n${input.correction.expectedBehavior}`
		);
	}
	if (input.comment) {
		sections.push(`Comment:\n${input.comment}`);
	}
	return sections.join("\n\n");
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:read",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;

		const body = await request.json();
		const parsed = feedbackSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}
		const { messageId, type, reasons, comment, correction } = parsed.data;
		const normalizedCorrection = normalizeCorrection(correction);
		const lifecycleState = initialFeedbackLifecycleState({
			type,
			reasons,
			comment,
			correction: normalizedCorrection,
		});
		const redactedComment = redactFeedbackText(comment);
		const redactedCorrection =
			redactFeedbackCorrection(normalizedCorrection);

		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				conversation: {
					userId: session.user.id,
					organizationId: workspace.organizationId,
				},
			},
			select: { id: true },
		});

		if (!message) {
			return NextResponse.json(
				{ error: "Message not found" },
				{ status: 404 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "chat:feedback",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { messageId, type, reasons, comment, correction },
			},
			async () => {
				const feedback = await prisma.messageFeedback.create({
					data: {
						messageId,
						userId: session.user.id,
						type,
						reasons,
						comment: formatFeedbackComment({
							comment,
							correction: normalizedCorrection,
						}),
						correctionJson: normalizedCorrection,
						lifecycleState,
						redactedComment: redactedComment.redacted,
						redactedCorrectionJson: redactedCorrection.redacted,
						provenanceJson: buildFeedbackProvenance({
							messageId,
							userId: session.user.id,
							reasons,
							source: "chat_feedback",
						}),
					},
				});

				return {
					body: { success: true },
					resourceType: "message_feedback",
					resourceId: feedback.id,
				};
			}
		);
	} catch (error) {
		logServerError("chat/feedback", "save_failed", error);
		return NextResponse.json(
			{ error: "Failed to save feedback" },
			{ status: 500 }
		);
	}
}
