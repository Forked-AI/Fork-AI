import { auth } from "@/lib/auth";
import {
	ConversationTitleGenerationError,
	getConversationTitleGenerationInput,
} from "@/lib/conversations/generate-title";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { conversationQueue } from "@/lib/queue/conversation";
import { resolveWorkspaceContext } from "@/lib/organizations/context";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// POST - Generate a title for a conversation using AI
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { id: conversationId } = await params;
		const userId = session.user.id;
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:write",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;

		return await withJsonIdempotency(
			request,
			{
				scope: "conversations:generate-title",
				actorKey: getUserIdempotencyActorKey(userId),
				requestInput: {
					conversationId,
					organizationId: workspace.organizationId,
				},
			},
			async () => {
				await getConversationTitleGenerationInput({
					conversationId,
					userId,
					organizationId: workspace.organizationId,
				});

				const job = await conversationQueue.add(
					"generate-title",
					{
						conversationId,
						userId,
						organizationId: workspace.organizationId,
					},
					{
						jobId: `generate-title:${userId}:${workspace.organizationId ?? "personal"}:${conversationId}`,
					}
				);

				return {
					body: {
						status: "queued",
						conversationId,
					},
					resourceType: "conversation_job",
					resourceId: String(job.id ?? conversationId),
				};
			}
		);
	} catch (error) {
		if (error instanceof ConversationTitleGenerationError) {
			if (error.code === "CONVERSATION_NOT_FOUND") {
				return NextResponse.json(
					{ error: "Conversation not found" },
					{ status: 404 }
				);
			}

			if (error.code === "NOT_ENOUGH_MESSAGES") {
				return NextResponse.json(
					{ error: "Not enough messages to generate title" },
					{ status: 400 }
				);
			}
		}

		logServerError(
			"conversations/generate-title",
			"generate_failed",
			error
		);
		return NextResponse.json(
			{ error: "Failed to queue title generation" },
			{ status: 500 }
		);
	}
}
