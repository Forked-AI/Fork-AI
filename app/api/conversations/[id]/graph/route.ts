import { auth } from "@/lib/auth";
import { markStaleGenerationsFailed } from "@/lib/chat/generation-service";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/conversations/[id]/graph
 * Get conversation messages as graph nodes for visualization
 */
export async function GET(
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
		await markStaleGenerationsFailed({
			userId: session.user.id,
			conversationId: id,
		});

		// Verify conversation belongs to user
		const conversation = await prisma.conversation.findFirst({
			where: {
				id,
				userId: session.user.id,
			},
		});

		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		// Get all messages with positions
		const messages = await prisma.message.findMany({
			where: {
				conversationId: id,
			},
			orderBy: {
				createdAt: "asc",
			},
			select: {
				id: true,
				role: true,
				content: true,
				model: true,
				parentMessageId: true,
				positionX: true,
				positionY: true,
				isRootNode: true,
				rootNodeName: true,
				createdAt: true,
				isError: true,
				status: true,
				errorCode: true,
				providerStatusCode: true,
				providerRequestId: true,
				startedAt: true,
				completedAt: true,
				cancelledAt: true,
				lastChunkAt: true,
			},
		});

		// Transform to graph format
		const nodes = messages.map((msg) => ({
			id: msg.id,
			role: msg.role,
			text: msg.content,
			replyTo: msg.parentMessageId,
			x: msg.positionX ?? 0,
			y: msg.positionY ?? 0,
			createdAt: msg.createdAt.getTime(),
			isRootNode: msg.isRootNode,
			rootNodeName: msg.rootNodeName,
			model: msg.model,
			isError: msg.isError,
			status: msg.status,
			errorCode: msg.errorCode,
			providerStatusCode: msg.providerStatusCode,
			providerRequestId: msg.providerRequestId,
			startedAt: msg.startedAt?.toISOString() ?? null,
			completedAt: msg.completedAt?.toISOString() ?? null,
			cancelledAt: msg.cancelledAt?.toISOString() ?? null,
			lastChunkAt: msg.lastChunkAt?.toISOString() ?? null,
		}));

		return NextResponse.json({
			id: id,
			nodes,
		});
	} catch (error) {
		logServerError("conversations/graph", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation graph" },
			{ status: 500 }
		);
	}
}
