import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/messages/[id]/drop
 * Atomic operation: attach to parent AND update position
 * Used during drag-and-drop to ensure consistency
 */
export async function PATCH(
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
		const body = await request.json();
		const { parentMessageId, positionX, positionY } = body;

		if (typeof positionX !== "number" || typeof positionY !== "number") {
			return NextResponse.json(
				{ error: "Invalid position coordinates" },
				{ status: 400 }
			);
		}

		// Verify message belongs to user's conversation
		const message = await prisma.message.findFirst({
			where: {
				id: id,
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

		// If parentMessageId is provided, verify and check for cycles
		if (parentMessageId) {
			const parent = await prisma.message.findFirst({
				where: {
					id: parentMessageId,
					conversationId: message.conversationId,
				},
			});

			if (!parent) {
				return NextResponse.json(
					{ error: "Parent message not found" },
					{ status: 404 }
				);
			}

			// Check for cycles
			const checkCycle = async (
				nodeId: string,
				targetId: string
			): Promise<boolean> => {
				if (nodeId === targetId) return true;
				const node = await prisma.message.findUnique({
					where: { id: nodeId },
					select: { parentMessageId: true },
				});
				if (!node?.parentMessageId) return false;
				return checkCycle(node.parentMessageId, targetId);
			};

			const hasCycle = await checkCycle(parentMessageId, id);
			if (hasCycle) {
				return NextResponse.json(
					{ error: "Cannot create cycle in message tree" },
					{ status: 400 }
				);
			}
		}

		// Atomic update: parent + position in single transaction
		const updated = await prisma.message.update({
			where: { id: id },
			data: {
				parentMessageId,
				positionX,
				positionY,
			},
		});

		return NextResponse.json({
			id: updated.id,
			parentMessageId: updated.parentMessageId,
			positionX: updated.positionX,
			positionY: updated.positionY,
		});
	} catch (error) {
		console.error("Error dropping message:", error);
		return NextResponse.json(
			{ error: "Failed to drop message" },
			{ status: 500 }
		);
	}
}
