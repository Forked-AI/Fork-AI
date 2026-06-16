import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/messages/[id]/duplicate
 * Duplicate a message with offset position
 */
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
				scope: "messages:duplicate",
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { id },
			},
			async () => {
				// Verify message belongs to user's conversation
				const message = await prisma.message.findFirst({
					where: {
						id,
						conversation: {
							userId: session.user.id,
						},
					},
				});

				if (!message) {
					return {
						body: { error: "Message not found" },
						status: 404,
					};
				}

				// Create duplicate with +30px offset
				const duplicate = await prisma.message.create({
					data: {
						conversationId: message.conversationId,
						role: message.role,
						content: message.content,
						model: message.model,
						promptTokens: message.promptTokens,
						completionTokens: message.completionTokens,
						isError: message.isError,
						status: message.status,
						errorCode: message.errorCode,
						providerStatusCode: message.providerStatusCode,
						providerRequestId: message.providerRequestId,
						startedAt: message.startedAt,
						completedAt: message.completedAt,
						cancelledAt: message.cancelledAt,
						lastChunkAt: message.lastChunkAt,
						parentMessageId: message.parentMessageId,
						positionX: message.positionX
							? message.positionX + 30
							: 30,
						positionY: message.positionY
							? message.positionY + 30
							: 30,
						isRootNode: false,
						rootNodeName: null,
					},
				});

				return {
					body: {
						id: duplicate.id,
						role: duplicate.role,
						content: duplicate.content,
						model: duplicate.model,
						isError: duplicate.isError,
						status: duplicate.status,
						errorCode: duplicate.errorCode,
						providerStatusCode: duplicate.providerStatusCode,
						providerRequestId: duplicate.providerRequestId,
						parentMessageId: duplicate.parentMessageId,
						positionX: duplicate.positionX,
						positionY: duplicate.positionY,
						createdAt: duplicate.createdAt.getTime(),
					},
					resourceType: "message",
					resourceId: duplicate.id,
				};
			}
		);
	} catch (error) {
		logServerError("messages/duplicate", "duplicate_failed", error);
		return NextResponse.json(
			{ error: "Failed to duplicate message" },
			{ status: 500 }
		);
	}
}
