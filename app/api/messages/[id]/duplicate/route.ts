import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
			return NextResponse.json(
				{ error: "Message not found" },
				{ status: 404 }
			);
		}

		// Create duplicate with +30px offset
		const duplicate = await prisma.message.create({
			data: {
				conversationId: message.conversationId,
				role: message.role,
				content: message.content,
				model: message.model,
				parentMessageId: message.parentMessageId,
				positionX: message.positionX ? message.positionX + 30 : 30,
				positionY: message.positionY ? message.positionY + 30 : 30,
				isRootNode: false,
				rootNodeName: null,
			},
		});

		return NextResponse.json({
			id: duplicate.id,
			role: duplicate.role,
			content: duplicate.content,
			model: duplicate.model,
			parentMessageId: duplicate.parentMessageId,
			positionX: duplicate.positionX,
			positionY: duplicate.positionY,
			createdAt: duplicate.createdAt.getTime(),
		});
	} catch (error) {
		console.error("Error duplicating message:", error);
		return NextResponse.json(
			{ error: "Failed to duplicate message" },
			{ status: 500 }
		);
	}
}
