import { requireAdminSession } from "@/lib/admin";
import { Prisma } from "@/generated/prisma/client";
import { buildFeedbackEvalCase } from "@/lib/feedback/eval-export";
import {
	feedbackCorrectionSchema,
	feedbackLifecycleStateSchema,
} from "@/lib/feedback/lifecycle";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateFeedbackSchema = z.object({
	feedbackId: z.string().min(1),
	lifecycleState: feedbackLifecycleStateSchema,
});

export async function GET(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	const { searchParams } = new URL(request.url);
	const state = feedbackLifecycleStateSchema
		.optional()
		.safeParse(searchParams.get("state") ?? undefined);
	if (!state.success) {
		return NextResponse.json({ error: "Invalid state" }, { status: 400 });
	}

	const rows = await prisma.messageFeedback.findMany({
		where: state.data ? { lifecycleState: state.data } : undefined,
		orderBy: { createdAt: "asc" },
		take: 100,
		select: {
			id: true,
			messageId: true,
			type: true,
			reasons: true,
			lifecycleState: true,
			redactedComment: true,
			redactedCorrectionJson: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return NextResponse.json({
		feedback: rows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		})),
	});
}

export async function PATCH(request: Request) {
	const admin = await requireAdminSession(request);
	if (!admin.ok) return admin.response;

	const parsed = updateFeedbackSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid input", details: parsed.error.flatten() },
			{ status: 400 }
		);
	}

	const feedback = await prisma.messageFeedback.findUnique({
		where: { id: parsed.data.feedbackId },
	});
	if (!feedback) {
		return NextResponse.json(
			{ error: "Feedback not found" },
			{ status: 404 }
		);
	}

	const redactedCorrection = feedbackCorrectionSchema.parse(
		feedback.redactedCorrectionJson ?? {}
	);
	const evalCase =
		parsed.data.lifecycleState === "accepted_to_eval"
			? buildFeedbackEvalCase({
					id: feedback.id,
					messageId: feedback.messageId,
					reasons: feedback.reasons,
					redactedComment: feedback.redactedComment ?? "",
					redactedCorrection,
					provenance:
						(feedback.provenanceJson as Record<string, unknown>) ??
						{},
				})
			: undefined;

	const updated = await prisma.messageFeedback.update({
		where: { id: feedback.id },
		data: {
			lifecycleState: parsed.data.lifecycleState,
			reviewedBy: admin.session.user.id,
			reviewedAt: new Date(),
			...(evalCase
				? {
						evalCaseJson: JSON.parse(
							JSON.stringify(evalCase)
						) as Prisma.InputJsonValue,
					}
				: {}),
		},
	});

	return NextResponse.json({
		feedback: {
			id: updated.id,
			lifecycleState: updated.lifecycleState,
			evalCase: updated.evalCaseJson ?? null,
		},
	});
}
