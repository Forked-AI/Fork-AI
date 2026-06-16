import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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

		const body = await request.json();
		const { messageId, type, reasons, comment } = body;

		if (!messageId || !type || !["good", "bad"].includes(type)) {
			return NextResponse.json(
				{ error: "Invalid input" },
				{ status: 400 }
			);
		}

		return await withJsonIdempotency(
			request,
			{
				scope: "chat:feedback",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { messageId, type, reasons, comment },
			},
			async () => {
				// Store feedback in database
				const feedback = await prisma.messageFeedback.create({
					data: {
						messageId,
						userId: session.user.id,
						type,
						reasons: reasons || [],
						comment: comment || "",
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
