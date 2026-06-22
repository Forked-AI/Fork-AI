import { randomUUID } from "node:crypto";
import { serializeFileObjectForAttachmentClient } from "@/lib/attachments/attachment-service";
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
import { resolveWorkspaceContext } from "@/lib/organizations/context";
import { logServerError, logServerInfo } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isFormDataFile(value: FormDataEntryValue | null): value is File {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as File).name === "string" &&
		typeof (value as File).size === "number" &&
		typeof (value as File).arrayBuffer === "function"
	);
}

function toJsonValue(body: unknown) {
	return JSON.parse(JSON.stringify(body));
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
		const workspaceResult = await resolveWorkspaceContext({
			session,
			requiredPermission: "workspace:write",
		});
		if (!workspaceResult.ok) return workspaceResult.response;
		const workspace = workspaceResult.workspace;

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
			typeof filenameOverride === "string" ? filenameOverride : undefined,
			{
				allowImages: true,
				buffer,
			}
		);
		const idempotency = await beginIdempotency(request, {
			scope: "attachments:upload",
			actorKey: getUserIdempotencyActorKey(workspace.userId),
			requestInput: {
				filename: validated.filename,
				mimeType: validated.mimeType,
				sizeBytes: validated.sizeBytes,
				kind: validated.kind,
				organizationId: workspace.organizationId,
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
				userId: workspace.userId,
				organizationId: workspace.organizationId,
				metadata: {
					filenameHash: hashModeratedContent(validated.filename),
					mimeType: validated.mimeType,
					kind: validated.kind,
					attachment: true,
				},
			});
			await recordAbuseSignal({
				signalType: "file_scanner_block",
				severity: moderationDecision.severity,
				action: "block",
				userId: workspace.userId,
				organizationId: workspace.organizationId,
				metadata: {
					category: moderationDecision.category,
					mimeType: validated.mimeType,
					attachment: true,
				},
			});
			const response = buildModerationBlockResponse(moderationDecision);
			const body = await response.json();
			await failIdempotency(activeIdempotency, body, response.status);
			return NextResponse.json(body, { status: response.status });
		}

		const fileId = `file_${randomUUID().replace(/-/g, "")}`;
		const storageKey = buildStoredFileKey({
			userId: workspace.userId,
			fileId,
			extension: validated.extension,
		});
		const storedFile = await saveFileObject({ storageKey, buffer });
		storedReference = {
			storageProvider: storedFile.storageProvider,
			storageKey: storedFile.storageKey,
		};

		const isImage = validated.kind === "image";
		const file = await prisma.fileObject.create({
			data: {
				id: fileId,
				userId: workspace.userId,
				organizationId: workspace.organizationId,
				storageProvider: storedFile.storageProvider,
				storageKey: storedFile.storageKey,
				kind: validated.kind,
				purpose: validated.purpose,
				filename: validated.filename,
				mimeType: validated.mimeType,
				extension: validated.extension,
				sizeBytes: validated.sizeBytes,
				checksumSha256: storedFile.checksumSha256,
				status: isImage ? "ready" : "uploaded",
				processedAt: isImage ? new Date() : null,
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

		if (shouldPersistModerationDecision(moderationDecision)) {
			await recordModerationEvent({
				decision: moderationDecision,
				source: "file_upload",
				stage: "file_upload",
				contentHash: hashModeratedContent(buffer),
				contentLength: validated.sizeBytes,
				userId: workspace.userId,
				organizationId: workspace.organizationId,
				fileObjectId: file.id,
				metadata: {
					filenameHash: hashModeratedContent(validated.filename),
					mimeType: validated.mimeType,
					kind: validated.kind,
					attachment: true,
				},
			});
		}

		const job = isImage
			? null
			: await enqueueUploadedFileProcessingJob({
					fileId: file.id,
					userId: workspace.userId,
				});
		const body = {
			attachment: serializeFileObjectForAttachmentClient(file),
			status: isImage ? "ready" : "queued",
			jobId: job ? String(job.id ?? "") : null,
		};

		await activeIdempotency.complete(toJsonValue(body), {
			status: isImage ? 201 : 202,
			resourceType: "file_object",
			resourceId: file.id,
		});

		logServerInfo("attachments", "upload_ready", {
			fileId: file.id,
			userId: workspace.userId,
			kind: file.kind,
			sizeBytes: validated.sizeBytes,
			queued: !isImage,
		});

		return NextResponse.json(body, { status: isImage ? 201 : 202 });
	} catch (error) {
		if (storedReference) {
			await deleteStoredFileObject(storedReference).catch(
				(deleteError) => {
					logServerError(
						"attachments",
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

		logServerError("attachments", "upload_failed", error);
		const body = {
			error: "Failed to upload attachment",
			errorCode: "ATTACHMENT_UPLOAD_FAILED",
		};
		await failIdempotency(activeIdempotency, body, 500);
		return NextResponse.json(body, { status: 500 });
	}
}
