import { auth } from "@/lib/auth";
import { markStaleGenerationsFailed } from "@/lib/chat/generation-service";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceContext } from "@/lib/organizations/context";
import { logServerError } from "@/lib/server-safe-log";
import { buildChildMap } from "@/lib/tree";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/conversations/[id]/tree
 * Get conversation messages in tree structure
 * Returns messages array and parent->children map
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
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:read",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;

		const { id: conversationId } = await params;
		await markStaleGenerationsFailed({
			userId: session.user.id,
			conversationId,
		});

		// Verify conversation belongs to user
		const conversation = await prisma.conversation.findFirst({
			where: {
				id: conversationId,
				userId: session.user.id,
				organizationId: workspace.organizationId,
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
				conversationId,
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
				status: true,
				errorCode: true,
				providerStatusCode: true,
				providerRequestId: true,
				startedAt: true,
				completedAt: true,
				cancelledAt: true,
				lastChunkAt: true,
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
		logServerError("conversations/tree", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation tree" },
			{ status: 500 }
		);
	}
}
