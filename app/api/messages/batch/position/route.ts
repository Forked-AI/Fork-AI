import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
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
		const uniqueMessageIds = Array.from(new Set(messageIds));
		const messages = await prisma.message.findMany({
			where: {
				id: { in: uniqueMessageIds },
				conversation: {
					userId: session.user.id,
				},
			},
			select: {
				id: true,
				positionX: true,
				positionY: true,
			},
		});

		if (messages.length !== uniqueMessageIds.length) {
			return NextResponse.json(
				{ error: "Some messages not found or unauthorized" },
				{ status: 404 }
			);
		}

		const messageById = new Map(messages.map((message) => [message.id, message]));
		const updatesToPersist = updates.filter((update: any) => {
			const existing = messageById.get(update.id);

			return (
				!existing ||
				existing.positionX !== update.positionX ||
				existing.positionY !== update.positionY
			);
		});

		if (updatesToPersist.length === 0) {
			return NextResponse.json({ updated: [] });
		}

		// Batch update using transaction
		const results = await prisma.$transaction(
			updatesToPersist.map((update: any) =>
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
		logServerError("messages/position", "batch_update_failed", error);
		return NextResponse.json(
			{ error: "Failed to batch update positions" },
			{ status: 500 }
		);
	}
}
