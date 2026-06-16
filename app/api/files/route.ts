import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import {
	beginIdempotency,
	getUserIdempotencyActorKey,
	type ActiveIdempotencyRecord,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { enqueueUploadedFileProcessingJob } from "@/lib/queue/file-processing";
import {
	FileValidationError,
	validateUploadFile,
} from "@/lib/rag/file-validation";
import {
	buildModerationBlockResponse,
	evaluateFileUploadModeration,
	hashModeratedContent,
	isBlockingModerationDecision,
	recordAbuseSignal,
	recordModerationEvent,
	shouldPersistModerationDecision,
} from "@/lib/moderation/moderation-service";
import {
	buildStoredFileKey,
	deleteStoredFileObject,
	saveFileObject,
} from "@/lib/rag/storage";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const listFilesQuerySchema = z.object({
	status: z
		.enum([
			"uploading",
			"uploaded",
			"processing",
			"ready",
			"failed",
			"deleted",
		])
		.optional(),
	limit: z.coerce.number().int().positive().max(100).default(50),
});

function toJsonValue(body: unknown) {
	return JSON.parse(JSON.stringify(body));
}

function isFormDataFile(value: FormDataEntryValue | null): value is File {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as File).name === "string" &&
		typeof (value as File).size === "number" &&
		typeof (value as File).arrayBuffer === "function"
	);
}

async function failIdempotency(
	record: ActiveIdempotencyRecord | null,
	body: unknown,
	status: number
) {
	if (record) {
		await record.fail(toJsonValue(body), { status });
	}
}

export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const url = new URL(request.url);
		const parsed = listFilesQuerySchema.safeParse({
			status: url.searchParams.get("status") ?? undefined,
			limit: url.searchParams.get("limit") ?? undefined,
		});

		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid query parameters",
					details: parsed.error.flatten(),
				},
				{ status: 400 }
			);
		}

		const files = await prisma.fileObject.findMany({
			where: {
				userId: session.user.id,
				purpose: "rag_document",
				...(parsed.data.status ? { status: parsed.data.status } : {}),
			},
			orderBy: { createdAt: "desc" },
			take: parsed.data.limit,
			select: {
				id: true,
				filename: true,
				mimeType: true,
				extension: true,
				sizeBytes: true,
				status: true,
				errorCode: true,
				chunkCount: true,
				createdAt: true,
				updatedAt: true,
				processedAt: true,
			},
		});

		return NextResponse.json({ files });
	} catch (error) {
		logServerError("files", "list_failed", error);
		return NextResponse.json(
			{ error: "Failed to list files" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	let activeIdempotency: ActiveIdempotencyRecord | null = null;
	let storedReference: {
		storageProvider: string;
		storageKey: string;
	} | null = null;

	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const formData = await request.formData();
		const upload = formData.get("file");
		const filenameOverride = formData.get("filename");

		if (!isFormDataFile(upload)) {
			return NextResponse.json(
				{
					error: "A file field is required.",
					errorCode: "FILE_REQUIRED",
				},
				{ status: 400 }
			);
		}

		const buffer = Buffer.from(await upload.arrayBuffer());
		const validated = validateUploadFile(
			upload,
			typeof filenameOverride === "string" ? filenameOverride : undefined
		);
		const idempotency = await beginIdempotency(request, {
			scope: "files:upload",
			actorKey: getUserIdempotencyActorKey(session.user.id),
			requestInput: {
				filename: validated.filename,
				mimeType: validated.mimeType,
				sizeBytes: validated.sizeBytes,
			},
			lockSeconds: 10 * 60,
		});

		if (!idempotency.started) {
			return idempotency.response;
		}

		activeIdempotency = idempotency.record;
		const moderationDecision = evaluateFileUploadModeration({
			filename: validated.filename,
			mimeType: validated.mimeType,
			buffer,
		});
		if (isBlockingModerationDecision(moderationDecision)) {
			await recordModerationEvent({
				decision: moderationDecision,
				source: "file_upload",
				stage: "file_upload",
				contentHash: hashModeratedContent(buffer),
				contentLength: validated.sizeBytes,
				userId: session.user.id,
				metadata: {
					filenameHash: hashModeratedContent(validated.filename),
					mimeType: validated.mimeType,
					kind: validated.kind,
				},
			});
			await recordAbuseSignal({
				signalType: "file_scanner_block",
				severity: moderationDecision.severity,
				action: "block",
				userId: session.user.id,
				metadata: {
					category: moderationDecision.category,
					mimeType: validated.mimeType,
				},
			});
			const response = buildModerationBlockResponse(moderationDecision);
			const body = await response.json();
			await failIdempotency(activeIdempotency, body, response.status);
			return NextResponse.json(body, { status: response.status });
		}

		const fileId = `file_${randomUUID().replace(/-/g, "")}`;
		const storageKey = buildStoredFileKey({
			userId: session.user.id,
			fileId,
			extension: validated.extension,
		});
		const storedFile = await saveFileObject({ storageKey, buffer });
		storedReference = {
			storageProvider: storedFile.storageProvider,
			storageKey: storedFile.storageKey,
		};

		const file = await prisma.fileObject.create({
			data: {
				id: fileId,
				userId: session.user.id,
				organizationId: null,
				storageProvider: storedFile.storageProvider,
				storageKey: storedFile.storageKey,
				kind: validated.kind,
				purpose: validated.purpose,
				filename: validated.filename,
				mimeType: validated.mimeType,
				extension: validated.extension,
				sizeBytes: validated.sizeBytes,
				checksumSha256: storedFile.checksumSha256,
				status: "uploaded",
			},
			select: {
				id: true,
				filename: true,
				mimeType: true,
				sizeBytes: true,
				status: true,
				chunkCount: true,
				createdAt: true,
			},
		});

		if (shouldPersistModerationDecision(moderationDecision)) {
			await recordModerationEvent({
				decision: moderationDecision,
				source: "file_upload",
				stage: "file_upload",
				contentHash: hashModeratedContent(buffer),
				contentLength: validated.sizeBytes,
				userId: session.user.id,
				fileObjectId: file.id,
				metadata: {
					filenameHash: hashModeratedContent(validated.filename),
					mimeType: validated.mimeType,
					kind: validated.kind,
				},
			});
		}

		const job = await enqueueUploadedFileProcessingJob({
			fileId: file.id,
			userId: session.user.id,
		});

		const body = {
			file,
			status: "queued",
			jobId: String(job.id ?? ""),
		};

		await activeIdempotency.complete(toJsonValue(body), {
			status: 202,
			resourceType: "file_object",
			resourceId: file.id,
		});

		logServerInfo("files", "upload_queued", {
			fileId: file.id,
			userId: session.user.id,
			sizeBytes: validated.sizeBytes,
		});

		return NextResponse.json(body, { status: 202 });
	} catch (error) {
		if (storedReference) {
			await deleteStoredFileObject(storedReference).catch(
				(deleteError) => {
					logServerError(
						"files",
						"stored_file_cleanup_failed",
						deleteError
					);
				}
			);
		}

		if (error instanceof FileValidationError) {
			const body = {
				error: error.message,
				errorCode: error.errorCode,
			};
			await failIdempotency(activeIdempotency, body, error.status);
			return NextResponse.json(body, { status: error.status });
		}

		logServerError("files", "upload_failed", error);
		const body = {
			error: "Failed to upload file",
			errorCode: "FILE_UPLOAD_FAILED",
		};
		await failIdempotency(activeIdempotency, body, 500);
		return NextResponse.json(body, { status: 500 });
	}
}
