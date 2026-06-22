import { serializeFileObjectForAttachmentClient } from "@/lib/attachments/attachment-service";
import { auth } from "@/lib/auth";
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { deleteStoredFileObject } from "@/lib/rag/storage";
import { resolveWorkspaceContext } from "@/lib/organizations/context";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ATTACHMENT_SELECT = {
	id: true,
	filename: true,
	mimeType: true,
	extension: true,
	kind: true,
	purpose: true,
	sizeBytes: true,
	status: true,
	errorCode: true,
	chunkCount: true,
	parsedTextBytes: true,
	createdAt: true,
	updatedAt: true,
	processedAt: true,
} as const;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
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

		const { id } = await params;
		const file = await prisma.fileObject.findFirst({
			where: {
				id,
				userId: workspace.userId,
				organizationId: workspace.organizationId,
			},
			select: ATTACHMENT_SELECT,
		});

		if (!file) {
			return NextResponse.json(
				{
					error: "Attachment not found",
					errorCode: "ATTACHMENT_NOT_FOUND",
				},
				{ status: 404 }
			);
		}

		return NextResponse.json({
			attachment: serializeFileObjectForAttachmentClient(file),
		});
	} catch (error) {
		logServerError("attachments", "fetch_failed", error);
		return NextResponse.json(
			{
				error: "Failed to fetch attachment",
				errorCode: "ATTACHMENT_FETCH_FAILED",
			},
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:write",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;

		const { id } = await params;
		const userId = workspace.userId;

		return await withJsonIdempotency(
			request,
			{
				scope: "attachments:delete",
				actorKey: getUserIdempotencyActorKey(userId),
				requestInput: { id, organizationId: workspace.organizationId },
			},
			async () => {
				const file = await prisma.fileObject.findFirst({
					where: {
						id,
						userId,
						organizationId: workspace.organizationId,
					},
					select: {
						id: true,
						storageProvider: true,
						storageKey: true,
					},
				});

				if (!file) {
					return {
						body: {
							error: "Attachment not found",
							errorCode: "ATTACHMENT_NOT_FOUND",
						},
						status: 404,
					};
				}

				await deleteStoredFileObject(file);
				await prisma.fileObject.delete({
					where: { id: file.id },
				});

				logServerInfo("attachments", "deleted", {
					fileId: file.id,
					userId,
				});

				return {
					body: {
						success: true,
						status: "deleted",
					},
					resourceType: "file_object",
					resourceId: file.id,
				};
			}
		);
	} catch (error) {
		logServerError("attachments", "delete_failed", error);
		return NextResponse.json(
			{
				error: "Failed to delete attachment",
				errorCode: "ATTACHMENT_DELETE_FAILED",
			},
			{ status: 500 }
		);
	}
}
