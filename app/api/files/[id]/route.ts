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
				purpose: "rag_document",
			},
			select: {
				id: true,
				filename: true,
				mimeType: true,
				extension: true,
				sizeBytes: true,
				status: true,
				errorCode: true,
				chunkCount: true,
				parsedTextBytes: true,
				createdAt: true,
				updatedAt: true,
				processedAt: true,
			},
		});

		if (!file) {
			return NextResponse.json(
				{ error: "File not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ file });
	} catch (error) {
		logServerError("files", "fetch_failed", error);
		return NextResponse.json(
			{ error: "Failed to fetch file" },
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
				scope: "files:delete",
				actorKey: getUserIdempotencyActorKey(userId),
				requestInput: { id, organizationId: workspace.organizationId },
			},
			async () => {
				const file = await prisma.fileObject.findFirst({
					where: {
						id,
						userId,
						organizationId: workspace.organizationId,
						purpose: "rag_document",
					},
					select: {
						id: true,
						storageProvider: true,
						storageKey: true,
					},
				});

				if (!file) {
					return {
						body: { error: "File not found" },
						status: 404,
					};
				}

				await deleteStoredFileObject(file);
				await prisma.fileObject.delete({
					where: { id: file.id },
				});

				logServerInfo("files", "deleted", {
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
		logServerError("files", "delete_failed", error);
		return NextResponse.json(
			{ error: "Failed to delete file" },
			{ status: 500 }
		);
	}
}
