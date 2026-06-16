import { createHash } from "node:crypto";
import { serializeFileObjectForAttachmentClient } from "@/lib/attachments/attachment-service";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueUploadedFileProcessingJob } from "@/lib/queue/file-processing";
import {
	FileValidationError,
	validateUploadFile,
} from "@/lib/rag/file-validation";
import {
	abortR2MultipartUpload,
	completeR2MultipartUpload,
	deleteStoredFileObject,
	readStoredFileObject,
} from "@/lib/rag/storage";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const completeDirectUploadSchema = z.object({
	fileObjectId: z.string().min(1),
	uploadId: z.string().min(1),
	parts: z
		.array(
			z.object({
				partNumber: z.number().int().min(1).max(10_000),
				etag: z.string().min(1).max(256),
			})
		)
		.min(1)
		.max(10_000),
});

function sanitizeEtag(etag: string) {
	return etag.trim();
}

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
	let completedObject: {
		storageProvider: string;
		storageKey: string;
	} | null = null;
	let fileId: string | null = null;
	let userId: string | null = null;
	let uploadId: string | null = null;
	let multipartCompleted = false;

	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}
		userId = session.user.id;

		const parsed = completeDirectUploadSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid direct upload completion request.",
					errorCode: "DIRECT_UPLOAD_INVALID_REQUEST",
					details: parsed.error.flatten(),
				},
				{ status: 400 }
			);
		}

		fileId = parsed.data.fileObjectId;
		uploadId = parsed.data.uploadId;
		const file = await prisma.fileObject.findFirst({
			where: {
				id: parsed.data.fileObjectId,
				userId: session.user.id,
			},
			select: {
				id: true,
				filename: true,
				mimeType: true,
				extension: true,
				kind: true,
				purpose: true,
				sizeBytes: true,
				status: true,
				storageProvider: true,
				storageKey: true,
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
					error: "Direct upload completion is only supported for R2 objects.",
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

		completedObject = {
			storageProvider: file.storageProvider,
			storageKey: file.storageKey,
		};

		await completeR2MultipartUpload({
			reference: completedObject,
			uploadId: parsed.data.uploadId,
			parts: parsed.data.parts.map((part) => ({
				partNumber: part.partNumber,
				etag: sanitizeEtag(part.etag),
			})),
		});
		multipartCompleted = true;

		const buffer = await readStoredFileObject(completedObject);
		if (buffer.byteLength !== file.sizeBytes) {
			throw new FileValidationError(
				"Uploaded object size does not match the signed upload request.",
				"DIRECT_UPLOAD_SIZE_MISMATCH"
			);
		}

		const validated = validateUploadFile(
			{
				name: file.filename,
				type: file.mimeType,
				size: file.sizeBytes,
			},
			file.filename,
			{
				allowImages: true,
				buffer,
			}
		);

		const checksumSha256 = createHash("sha256")
			.update(buffer)
			.digest("hex");
		const isImage = validated.kind === "image";
		const updatedFile = await prisma.fileObject.update({
			where: { id: file.id },
			data: {
				mimeType: validated.mimeType,
				kind: validated.kind,
				purpose: validated.purpose,
				checksumSha256,
				status: isImage ? "ready" : "uploaded",
				processedAt: isImage ? new Date() : null,
				errorCode: null,
				errorMessage: null,
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
				updatedAt: true,
				processedAt: true,
			},
		});

		const job = isImage
			? null
			: await enqueueUploadedFileProcessingJob({
					fileId: file.id,
					userId: session.user.id,
				}).catch(async (error) => {
					await prisma.fileObject.update({
						where: { id: file.id },
						data: {
							status: "failed",
							errorCode: "FILE_PROCESSING_QUEUE_FAILED",
							errorMessage:
								"Failed to queue attachment for indexing.",
							processedAt: new Date(),
						},
					});
					throw error;
				});

		logServerInfo("attachments/direct", "upload_completed", {
			fileId: file.id,
			userId: session.user.id,
			kind: validated.kind,
			sizeBytes: file.sizeBytes,
			queued: !isImage,
		});

		return NextResponse.json(
			{
				attachment: serializeFileObjectForAttachmentClient(updatedFile),
				status: isImage ? "ready" : "queued",
				jobId: job ? String(job.id ?? "") : null,
			},
			{ status: isImage ? 201 : 202 }
		);
	} catch (error) {
		if (completedObject && fileId && userId) {
			if (!multipartCompleted && uploadId) {
				await abortR2MultipartUpload({
					reference: completedObject,
					uploadId,
				}).catch((abortError) => {
					logServerError(
						"attachments/direct",
						"multipart_abort_failed",
						abortError
					);
				});
			} else {
				await deleteStoredFileObject(completedObject).catch(
					(deleteError) => {
						logServerError(
							"attachments/direct",
							"stored_file_cleanup_failed",
							deleteError
						);
					}
				);
			}
			await prisma.fileObject
				.update({
					where: { id: fileId },
					data: {
						status: "failed",
						errorCode:
							error instanceof FileValidationError
								? error.errorCode
								: "DIRECT_UPLOAD_COMPLETE_FAILED",
						errorMessage:
							error instanceof FileValidationError
								? error.message
								: "Failed to complete direct upload.",
						processedAt: new Date(),
					},
				})
				.catch(() => undefined);
		}

		if (error instanceof FileValidationError) {
			return validationErrorResponse(error);
		}

		logServerError("attachments/direct", "complete_failed", error);
		return NextResponse.json(
			{
				error: "Failed to complete direct upload",
				errorCode: "DIRECT_UPLOAD_COMPLETE_FAILED",
			},
			{ status: 500 }
		);
	}
}
