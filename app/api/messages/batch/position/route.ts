import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/messages/batch/position
 * Batch update positions for multiple messages (multi-drag)
 */
export async function PATCH(request: NextRequest) {
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

		const body = await request.json();
		const { updates } = body;

		if (!Array.isArray(updates) || updates.length === 0) {
			return NextResponse.json(
				{ error: "Invalid updates array" },
				{ status: 400 }
			);
		}

		// Validate all updates
		for (const update of updates) {
			if (
				!update.id ||
				typeof update.positionX !== "number" ||
				typeof update.positionY !== "number"
			) {
				return NextResponse.json(
					{ error: "Invalid update format" },
					{ status: 400 }
				);
			}
		}

		// Verify all messages belong to user's conversations
		const messageIds = updates.map((u: any) => u.id);
		const messages = await prisma.message.findMany({
			where: {
				id: { in: messageIds },
				conversation: {
					userId: session.user.id,
				},
			},
			select: { id: true },
		});

		if (messages.length !== messageIds.length) {
			return NextResponse.json(
				{ error: "Some messages not found or unauthorized" },
				{ status: 404 }
			);
		}

		// Batch update using transaction
		const results = await prisma.$transaction(
			updates.map((update: any) =>
				prisma.message.update({
					where: { id: update.id },
					data: {
						positionX: update.positionX,
						positionY: update.positionY,
					},
				})
			)
		);

		return NextResponse.json({
			updated: results.map((msg) => ({
				id: msg.id,
				positionX: msg.positionX,
				positionY: msg.positionY,
			})),
		});
	} catch (error) {
		console.error("Error batch updating positions:", error);
		return NextResponse.json(
			{ error: "Failed to batch update positions" },
			{ status: 500 }
		);
	}
}
