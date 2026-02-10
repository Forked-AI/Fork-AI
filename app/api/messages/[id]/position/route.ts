import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/messages/[id]/position
 * Update message position for graph visualization
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
		const { positionX, positionY } = body;

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

		// Update position
		const updated = await prisma.message.update({
			where: { id: id },
			data: {
				positionX,
				positionY,
			},
		});

		return NextResponse.json({
			id: updated.id,
			positionX: updated.positionX,
			positionY: updated.positionY,
		});
	} catch (error) {
		console.error("Error updating message position:", error);
		return NextResponse.json(
			{ error: "Failed to update position" },
			{ status: 500 }
		);
	}
}
