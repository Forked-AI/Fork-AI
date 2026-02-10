import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/messages/[id]?keepReplies=true|false
 * Delete message node only OR entire thread
 * - keepReplies=true: Re-attach children to parent (delete node only)
 * - keepReplies=false: Delete entire subtree (default)
 */
export async function DELETE(
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
		const { searchParams } = new URL(request.url);
		const keepReplies = searchParams.get("keepReplies") === "true";

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

		if (keepReplies) {
			// Delete node only, re-attach children to parent
			const children = await prisma.message.findMany({
				where: { parentMessageId: id },
				select: { id: true },
			});

			await prisma.$transaction([
				// Re-attach children to grandparent
				prisma.message.updateMany({
					where: { parentMessageId: id },
					data: { parentMessageId: message.parentMessageId },
				}),
				// Delete the message
				prisma.message.delete({
					where: { id },
				}),
			]);

			return NextResponse.json({
				success: true,
				deletedIds: [id],
				reattachedCount: children.length,
			});
		} else {
			// Delete entire thread (message + all descendants)
			const getDescendantIds = async (
				nodeId: string
			): Promise<string[]> => {
				const children = await prisma.message.findMany({
					where: { parentMessageId: nodeId },
					select: { id: true },
				});

				const childIds = children.map((c) => c.id);
				const descendantIds = await Promise.all(
					childIds.map((id) => getDescendantIds(id))
				);

				return [nodeId, ...childIds, ...descendantIds.flat()];
			};

			const idsToDelete = await getDescendantIds(id);

			// Delete all in transaction
			await prisma.message.deleteMany({
				where: {
					id: { in: idsToDelete },
				},
			});

			return NextResponse.json({
				success: true,
				deletedIds: idsToDelete,
			});
		}
	} catch (error) {
		console.error("Error deleting message:", error);
		return NextResponse.json(
			{ error: "Failed to delete message" },
			{ status: 500 }
		);
	}
}
