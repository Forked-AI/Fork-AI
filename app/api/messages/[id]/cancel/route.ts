import { auth } from "@/lib/auth";
import { cancelGenerationByAssistantMessage } from "@/lib/chat/generation-service";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { logServerError } from "@/lib/server-safe-log";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { id } = await params;

		return await withJsonIdempotency(
			request,
			{
				scope: "messages:cancel-generation",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { assistantMessageId: id },
			},
			async () => {
				const cancelled = await cancelGenerationByAssistantMessage({
					assistantMessageId: id,
					userId: session.user.id,
				});

				if (!cancelled) {
					return {
						body: { error: "Message not found" },
						status: 404,
					};
				}

				return {
					body: cancelled,
					resourceType: "message",
					resourceId: cancelled.messageId,
				};
			}
		);
	} catch (error) {
		logServerError("messages/cancel", "cancel_failed", error);
		return NextResponse.json(
			{ error: "Failed to cancel generation" },
			{ status: 500 }
		);
	}
}
