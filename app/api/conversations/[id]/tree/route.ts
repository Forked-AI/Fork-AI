import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildChildMap } from "@/lib/tree";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/conversations/[id]/tree
 * Get conversation messages in tree structure
 * Returns messages array and parent->children map
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
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

		// Verify conversation belongs to user
		const conversation = await prisma.conversation.findFirst({
			where: {
				id: params.id,
				userId: session.user.id,
			},
		});

		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		// Get all messages
		const messages = await prisma.message.findMany({
			where: {
				conversationId: params.id,
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
				isError: true,
				createdAt: true,
			},
		});

		// Build tree structure
		const tree = buildChildMap(
			messages.map((m) => ({
				id: m.id,
				parentMessageId: m.parentMessageId,
			}))
		);

		// Convert Map to plain object for JSON
		const treeObject: Record<string, string[]> = {};
		tree.forEach((children, parentId) => {
			const key = parentId === null ? "null" : parentId;
			treeObject[key] = children;
		});

		return NextResponse.json({
			messages,
			tree: treeObject,
		});
	} catch (error) {
		console.error("Error fetching conversation tree:", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation tree" },
			{ status: 500 }
		);
	}
}
