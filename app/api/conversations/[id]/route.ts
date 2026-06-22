import { auth } from "@/lib/auth";
import { buildMessageTrustTrace } from "@/lib/ai/trust-trace";
import { markStaleGenerationsFailed } from "@/lib/chat/generation-service";
import { prisma } from "@/lib/prisma";
import {
	recordOrganizationAuditLog,
	resolveWorkspaceContext,
} from "@/lib/organizations/context";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const moveConversationSchema = z.object({
	collectionId: z.string().nullable(),
});

const updateConversationSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	collectionId: z.string().nullable().optional(),
	isPinned: z.boolean().optional(),
});

// GET - Fetch a single conversation with all messages
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Please sign in to save conversations" },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:read",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;
		const { id: conversationId } = await params;
		await markStaleGenerationsFailed({ userId, conversationId });

		const conversation = await prisma.conversation.findFirst({
			where: {
				id: conversationId,
				userId: userId,
				organizationId: workspace.organizationId,
			},
			include: {
				messages: {
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						role: true,
						content: true,
						model: true,
						promptTokens: true,
						completionTokens: true,
						isError: true,
						status: true,
						errorCode: true,
						providerStatusCode: true,
						providerRequestId: true,
						startedAt: true,
						completedAt: true,
						cancelledAt: true,
						lastChunkAt: true,
						promptVersion: true,
						contextSummaryId: true,
						contextEstimatedTokens: true,
						contextRecentMessageCount: true,
						contextTotalMessageCount: true,
						ragContextChunkIds: true,
						ragCitationData: true,
						activeSkillTraceJson: true,
						promptSkillHash: true,
						createdAt: true,
						parentMessageId: true,
						attachments: {
							orderBy: { displayOrder: "asc" },
							select: {
								id: true,
								fileObjectId: true,
								kind: true,
								promptUse: true,
								displayOrder: true,
								fileObject: {
									select: {
										id: true,
										filename: true,
										mimeType: true,
										sizeBytes: true,
										status: true,
										kind: true,
										purpose: true,
									},
								},
							},
						},
						generationAsAssistantMessage: {
							select: {
								id: true,
								provider: true,
								model: true,
								status: true,
								promptVersion: true,
								contextSummaryId: true,
								contextEstimatedTokens: true,
								contextRecentMessageCount: true,
								contextTotalMessageCount: true,
								usageEvent: {
									select: {
										resolvedModel: true,
										providerRequestId: true,
									},
								},
								userMessage: {
									select: {
										toolExecutions: {
											orderBy: { createdAt: "asc" },
											select: {
												id: true,
												toolName: true,
												status: true,
												riskLevel: true,
												requiresConfirmation: true,
											},
										},
									},
								},
							},
						},
					},
				},
				collection: {
					select: {
						id: true,
						name: true,
						color: true,
					},
				},
			},
		});

		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		const messages = conversation.messages.map((message) => {
			const { generationAsAssistantMessage, ...safeMessage } = message;
			return {
				...safeMessage,
				trustTrace:
					message.role === "assistant"
						? buildMessageTrustTrace({
								...safeMessage,
								generationAsAssistantMessage,
							})
						: null,
			};
		});

		return NextResponse.json({
			conversation: {
				...conversation,
				messages,
			},
		});
	} catch (error) {
		logServerError("conversations", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation" },
			{ status: 500 }
		);
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Please sign in to save conversations" },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:write",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;
		const { id: conversationId } = await params;
		const body = await request.json();

		const result = updateConversationSchema.safeParse(body);
		if (!result.success) {
			return NextResponse.json(
				{ error: result.error.errors[0].message },
				{ status: 400 }
			);
		}

		const { title, collectionId, isPinned } = result.data;

		// Check conversation ownership
		const existing = await prisma.conversation.findFirst({
			where: {
				id: conversationId,
				userId,
				organizationId: workspace.organizationId,
			},
		});

		if (!existing) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		const existingConversation = existing as typeof existing & {
			isPinned?: boolean;
		};

		// Build update data - only include fields whose effective value changes
		const updateData: {
			title?: string;
			collectionId?: string | null;
			isPinned?: boolean;
			pinnedAt?: Date | null;
		} = {};

		if (title !== undefined && title !== existing.title.trim()) {
			updateData.title = title;
		}

		if (
			collectionId !== undefined &&
			collectionId !== existing.collectionId
		) {
			updateData.collectionId = collectionId;
		}

		if (
			isPinned !== undefined &&
			isPinned !== existingConversation.isPinned
		) {
			updateData.isPinned = isPinned;
			updateData.pinnedAt = isPinned ? new Date() : null;
		}

		if (Object.keys(updateData).length === 0) {
			return NextResponse.json({ conversation: existing });
		}

		// If moving to a collection, verify collection ownership
		if (updateData.collectionId) {
			const collection = await prisma.collection.findFirst({
				where: {
					id: updateData.collectionId,
					userId,
					isDefault: false,
				},
			});

			if (!collection) {
				return NextResponse.json(
					{ error: "Collection not found" },
					{ status: 404 }
				);
			}
		}

		// Update conversation
		const conversation = await prisma.conversation.update({
			where: { id: conversationId },
			data: updateData,
		});
		await recordOrganizationAuditLog({
			workspace,
			action: "conversation.update",
			targetType: "conversation",
			targetId: conversationId,
			request,
			metadata: { changedFields: Object.keys(updateData) },
		});

		return NextResponse.json({ conversation });
	} catch (error) {
		logServerError("conversations", "update_failed", error);
		return NextResponse.json(
			{ error: "Failed to move conversation" },
			{ status: 500 }
		);
	}
}

// DELETE - Delete a conversation and all its messages
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session) {
			return NextResponse.json(
				{ error: "Please sign in to save conversations" },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:write",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;
		const { id: conversationId } = await params;

		// Check ownership
		const existing = await prisma.conversation.findFirst({
			where: {
				id: conversationId,
				userId,
				organizationId: workspace.organizationId,
			},
		});

		if (!existing) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		// Delete conversation (messages cascade delete due to schema)
		await prisma.conversation.delete({
			where: { id: conversationId },
		});
		await recordOrganizationAuditLog({
			workspace,
			action: "conversation.delete",
			targetType: "conversation",
			targetId: conversationId,
			request,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		logServerError("conversations", "delete_failed", error);
		return NextResponse.json(
			{ error: "Failed to delete conversation" },
			{ status: 500 }
		);
	}
}
