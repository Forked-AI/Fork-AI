import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
		}));

		return NextResponse.json({
			id: id,
			nodes,
		});
	} catch (error) {
		console.error("Error fetching conversation graph:", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation graph" },
			{ status: 500 }
		);
	}
}
