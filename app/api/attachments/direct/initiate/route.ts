import { randomUUID } from "node:crypto";
import { serializeFileObjectForAttachmentClient } from "@/lib/attachments/attachment-service";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	FileValidationError,
	validateUploadFile,
} from "@/lib/rag/file-validation";
import {
	buildStoredFileKey,
	createR2MultipartUpload,
	isR2DirectUploadAvailable,
} from "@/lib/rag/storage";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const initiateDirectUploadSchema = z.object({
	filename: z.string().min(1).max(255),
	mimeType: z.string().min(1).max(255),
	sizeBytes: z.number().int().positive(),
});

function validationErrorResponse(error: FileValidationError) {
	return NextResponse.json(
		{
			error: error.message,
			errorCode: error.errorCode,
		},
		{ status: error.status }
	);
}

export async function POST(request: Request) {
	let fileId: string | null = null;

	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		if (!isR2DirectUploadAvailable()) {
			return NextResponse.json(
				{
					error: "Direct browser upload is only available for R2 storage.",
					errorCode: "DIRECT_UPLOAD_UNSUPPORTED",
				},
				{ status: 409 }
			);
		}

		const parsed = initiateDirectUploadSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid direct upload request.",
					errorCode: "DIRECT_UPLOAD_INVALID_REQUEST",
					details: parsed.error.flatten(),
				},
				{ status: 400 }
			);
		}

		const validated = validateUploadFile(
			{
				name: parsed.data.filename,
				type: parsed.data.mimeType,
				size: parsed.data.sizeBytes,
			},
			undefined,
			{
				allowImages: true,
				validateContent: false,
			}
		);

		fileId = `file_${randomUUID().replace(/-/g, "")}`;
		const storageKey = buildStoredFileKey({
			userId: session.user.id,
			fileId,
			extension: validated.extension,
		});

		const file = await prisma.fileObject.create({
			data: {
				id: fileId,
				userId: session.user.id,
				organizationId: null,
				storageProvider: "r2",
				storageKey,
				kind: validated.kind,
				purpose: validated.purpose,
				filename: validated.filename,
				mimeType: validated.mimeType,
				extension: validated.extension,
				sizeBytes: validated.sizeBytes,
				checksumSha256: `direct-upload-pending:${fileId}`,
				status: "uploading",
			},
			select: {
				id: true,
				filename: true,
				mimeType: true,
				kind: true,
				purpose: true,
				sizeBytes: true,
				status: true,
				chunkCount: true,
				errorCode: true,
				createdAt: true,
			},
		});

		const upload = await createR2MultipartUpload({
			storageKey,
			mimeType: validated.mimeType,
			sizeBytes: validated.sizeBytes,
		});

		logServerInfo("attachments/direct", "upload_initiated", {
			fileId,
			userId: session.user.id,
			kind: validated.kind,
			partCount: upload.parts.length,
			sizeBytes: validated.sizeBytes,
		});

		return NextResponse.json(
			{
				attachment: serializeFileObjectForAttachmentClient(file),
				upload: {
					fileObjectId: file.id,
					uploadId: upload.uploadId,
					partSizeBytes: upload.partSizeBytes,
					expiresInSeconds: upload.expiresInSeconds,
					storageProvider: "r2",
					parts: upload.parts,
				},
			},
			{ status: 201 }
		);
	} catch (error) {
		if (fileId) {
			await prisma.fileObject
				.delete({ where: { id: fileId } })
				.catch(() => undefined);
		}

		if (error instanceof FileValidationError) {
			return validationErrorResponse(error);
		}

		logServerError("attachments/direct", "initiate_failed", error);
		return NextResponse.json(
			{
				error: "Failed to initiate direct upload",
				errorCode: "DIRECT_UPLOAD_INITIATE_FAILED",
			},
			{ status: 500 }
		);
	}
}
