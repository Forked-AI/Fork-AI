import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { abortR2MultipartUpload } from "@/lib/rag/storage";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const abortDirectUploadSchema = z.object({
	fileObjectId: z.string().min(1),
	uploadId: z.string().min(1),
});

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const parsed = abortDirectUploadSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid direct upload abort request.",
					errorCode: "DIRECT_UPLOAD_INVALID_REQUEST",
					details: parsed.error.flatten(),
				},
				{ status: 400 }
			);
		}

		const file = await prisma.fileObject.findFirst({
			where: {
				id: parsed.data.fileObjectId,
				userId: session.user.id,
			},
			select: {
				id: true,
				storageProvider: true,
				storageKey: true,
				status: true,
			},
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

		if (file.storageProvider !== "r2") {
			return NextResponse.json(
				{
					error: "Direct upload abort is only supported for R2 objects.",
					errorCode: "DIRECT_UPLOAD_UNSUPPORTED",
				},
				{ status: 409 }
			);
		}

		if (file.status !== "uploading") {
			return NextResponse.json(
				{
					error: "Attachment is not waiting for direct upload completion.",
					errorCode: "DIRECT_UPLOAD_INVALID_STATE",
				},
				{ status: 409 }
			);
		}

		await abortR2MultipartUpload({
			reference: {
				storageProvider: file.storageProvider,
				storageKey: file.storageKey,
			},
			uploadId: parsed.data.uploadId,
		});
		await prisma.fileObject.delete({ where: { id: file.id } });

		logServerInfo("attachments/direct", "upload_aborted", {
			fileId: file.id,
			userId: session.user.id,
		});

		return NextResponse.json({
			success: true,
			status: "aborted",
		});
	} catch (error) {
		logServerError("attachments/direct", "abort_failed", error);
		return NextResponse.json(
			{
				error: "Failed to abort direct upload",
				errorCode: "DIRECT_UPLOAD_ABORT_FAILED",
			},
			{ status: 500 }
		);
	}
}
