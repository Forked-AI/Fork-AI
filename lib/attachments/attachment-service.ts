import type { ModelCapabilities } from "@/lib/ai/orchestrator";
import type {
	ProviderContentPart,
	ProviderMessage,
} from "@/lib/chat-system-prompt";
import {
	getPresignedStoredFileUrl,
	readStoredFileObject,
} from "@/lib/rag/storage";

function parsePositiveIntegerEnv(name: string, fallback: number) {
	const rawValue = process.env[name]?.trim();
	if (!rawValue) {
		return fallback;
	}

	const parsed = Number(rawValue);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
}

export const MAX_ATTACHMENTS_PER_MESSAGE = parsePositiveIntegerEnv(
	"MAX_ATTACHMENTS_PER_MESSAGE",
	10
);
export const MAX_IMAGES_PER_MESSAGE = parsePositiveIntegerEnv(
	"MAX_IMAGES_PER_MESSAGE",
	4
);

export interface AttachmentRequestInput {
	fileObjectId: string;
}

export interface PreparedMessageAttachment {
	fileObjectId: string;
	kind: "document" | "image";
	promptUse: "rag" | "vision";
	displayOrder: number;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	storageProvider: string;
	storageKey: string;
}

interface AttachmentFileRecord {
	id: string;
	kind: string;
	purpose: string;
	status: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	storageProvider: string;
	storageKey: string;
}

interface PersistedMessageAttachmentRecord {
	fileObjectId: string;
	kind: "document" | "image";
	promptUse: "rag" | "vision";
	displayOrder: number;
	fileObject: AttachmentFileRecord;
}

export class AttachmentValidationError extends Error {
	public readonly errorCode: string;
	public readonly status: number;

	constructor(message: string, errorCode: string, status = 400) {
		super(message);
		this.name = "AttachmentValidationError";
		this.errorCode = errorCode;
		this.status = status;
	}
}

function normalizeAttachmentInputs({
	attachments,
	ragFileIds,
}: {
	attachments?: AttachmentRequestInput[];
	ragFileIds?: string[];
}) {
	const seen = new Set<string>();
	const normalized: AttachmentRequestInput[] = [];

	for (const attachment of attachments ?? []) {
		const fileObjectId = attachment.fileObjectId.trim();
		if (!fileObjectId || seen.has(fileObjectId)) continue;
		seen.add(fileObjectId);
		normalized.push({ fileObjectId });
	}

	for (const ragFileId of ragFileIds ?? []) {
		const fileObjectId = ragFileId.trim();
		if (!fileObjectId || seen.has(fileObjectId)) continue;
		seen.add(fileObjectId);
		normalized.push({ fileObjectId });
	}

	return normalized;
}

function toPromptUse(file: {
	kind: string;
	purpose: string;
}): "rag" | "vision" {
	return file.kind === "image" || file.purpose === "vision_image"
		? "vision"
		: "rag";
}

function toAttachmentKind(file: { kind: string }): "document" | "image" {
	return file.kind === "image" ? "image" : "document";
}

export async function prepareMessageAttachments({
	userId,
	modelCapabilities,
	attachments,
	ragFileIds,
	prismaClient,
}: {
	userId: string;
	modelCapabilities: ModelCapabilities;
	attachments?: AttachmentRequestInput[];
	ragFileIds?: string[];
	prismaClient: any;
}): Promise<PreparedMessageAttachment[]> {
	const normalizedInputs = normalizeAttachmentInputs({
		attachments,
		ragFileIds,
	});
	if (normalizedInputs.length === 0) {
		return [];
	}

	if (normalizedInputs.length > MAX_ATTACHMENTS_PER_MESSAGE) {
		throw new AttachmentValidationError(
			`A message can include at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments.`,
			"ATTACHMENT_LIMIT_EXCEEDED"
		);
	}

	const ids = normalizedInputs.map((attachment) => attachment.fileObjectId);
	const files = await prismaClient.fileObject.findMany({
		where: {
			id: { in: ids },
			userId,
		},
		select: {
			id: true,
			kind: true,
			purpose: true,
			status: true,
			filename: true,
			mimeType: true,
			sizeBytes: true,
			storageProvider: true,
			storageKey: true,
		},
	});
	const fileById = new Map<string, AttachmentFileRecord>(
		(files as AttachmentFileRecord[]).map((file) => [file.id, file])
	);

	if (fileById.size !== ids.length) {
		throw new AttachmentValidationError(
			"One or more attachments were not found.",
			"ATTACHMENT_NOT_FOUND",
			404
		);
	}

	const prepared = normalizedInputs.map((input, index) => {
		const file = fileById.get(input.fileObjectId);
		if (!file) {
			throw new AttachmentValidationError(
				"One or more attachments were not found.",
				"ATTACHMENT_NOT_FOUND",
				404
			);
		}
		const promptUse = toPromptUse(file);
		const kind = toAttachmentKind(file);

		if (file.status !== "ready") {
			throw new AttachmentValidationError(
				"Attached files must finish processing before they can be sent.",
				"ATTACHMENT_NOT_READY",
				409
			);
		}

		if (promptUse === "rag" && file.purpose !== "rag_document") {
			throw new AttachmentValidationError(
				"Document attachments must be searchable RAG documents.",
				"ATTACHMENT_PURPOSE_MISMATCH"
			);
		}

		if (promptUse === "vision" && file.purpose !== "vision_image") {
			throw new AttachmentValidationError(
				"Image attachments must be vision images.",
				"ATTACHMENT_PURPOSE_MISMATCH"
			);
		}

		return {
			fileObjectId: file.id,
			kind,
			promptUse,
			displayOrder: index,
			filename: file.filename,
			mimeType: file.mimeType,
			sizeBytes: file.sizeBytes,
			storageProvider: file.storageProvider,
			storageKey: file.storageKey,
		};
	});

	const imageCount = prepared.filter(
		(attachment) => attachment.kind === "image"
	).length;
	if (imageCount > MAX_IMAGES_PER_MESSAGE) {
		throw new AttachmentValidationError(
			`A message can include at most ${MAX_IMAGES_PER_MESSAGE} images.`,
			"IMAGE_ATTACHMENT_LIMIT_EXCEEDED"
		);
	}

	if (imageCount > 0 && !modelCapabilities.supportsImages) {
		throw new AttachmentValidationError(
			"The selected model does not support image attachments.",
			"MODEL_DOES_NOT_SUPPORT_IMAGES",
			400
		);
	}

	return prepared;
}

export async function loadPersistedMessageAttachments({
	userId,
	messageId,
	modelCapabilities,
	prismaClient,
}: {
	userId: string;
	messageId: string;
	modelCapabilities: ModelCapabilities;
	prismaClient: any;
}): Promise<PreparedMessageAttachment[]> {
	if (!prismaClient.messageAttachment?.findMany) {
		return [];
	}

	const attachments = await prismaClient.messageAttachment.findMany({
		where: {
			userId,
			messageId,
		},
		orderBy: { displayOrder: "asc" },
		include: {
			fileObject: {
				select: {
					id: true,
					status: true,
					kind: true,
					purpose: true,
					filename: true,
					mimeType: true,
					sizeBytes: true,
					storageProvider: true,
					storageKey: true,
				},
			},
		},
	});

	for (const attachment of attachments as PersistedMessageAttachmentRecord[]) {
		if (attachment.fileObject.status !== "ready") {
			throw new AttachmentValidationError(
				"Attached files must finish processing before they can be sent.",
				"ATTACHMENT_NOT_READY",
				409
			);
		}
	}

	const prepared = (attachments as PersistedMessageAttachmentRecord[]).map(
		(attachment) => ({
			fileObjectId: attachment.fileObjectId,
			kind: attachment.kind as "document" | "image",
			promptUse: attachment.promptUse as "rag" | "vision",
			displayOrder: attachment.displayOrder,
			filename: attachment.fileObject.filename,
			mimeType: attachment.fileObject.mimeType,
			sizeBytes: attachment.fileObject.sizeBytes,
			storageProvider: attachment.fileObject.storageProvider,
			storageKey: attachment.fileObject.storageKey,
		})
	);

	if (
		prepared.some((attachment) => attachment.kind === "image") &&
		!modelCapabilities.supportsImages
	) {
		throw new AttachmentValidationError(
			"The selected model does not support image attachments.",
			"MODEL_DOES_NOT_SUPPORT_IMAGES",
			400
		);
	}

	return prepared;
}

export function getRagFileIdsFromAttachments(
	attachments: PreparedMessageAttachment[]
) {
	return attachments
		.filter((attachment) => attachment.promptUse === "rag")
		.map((attachment) => attachment.fileObjectId);
}

export async function createMessageAttachmentRows({
	prismaClient,
	messageId,
	conversationId,
	userId,
	attachments,
}: {
	prismaClient: any;
	messageId: string;
	conversationId: string;
	userId: string;
	attachments: PreparedMessageAttachment[];
}) {
	if (attachments.length === 0) {
		return;
	}

	await prismaClient.messageAttachment.createMany({
		data: attachments.map((attachment) => ({
			messageId,
			conversationId,
			userId,
			fileObjectId: attachment.fileObjectId,
			kind: attachment.kind,
			promptUse: attachment.promptUse,
			displayOrder: attachment.displayOrder,
		})),
		skipDuplicates: true,
	});
}

function toDataUrl({ mimeType, buffer }: { mimeType: string; buffer: Buffer }) {
	return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function parseVisionImageDeliveryMode() {
	const mode = (process.env.VISION_IMAGE_DELIVERY_MODE ?? "auto")
		.trim()
		.toLowerCase();

	if (mode === "base64" || mode === "presigned_url" || mode === "auto") {
		return mode;
	}

	return "auto";
}

function getVisionImagePresignedUrlTtlSeconds() {
	return Math.min(
		3600,
		Math.max(
			30,
			parsePositiveIntegerEnv(
				"VISION_IMAGE_PRESIGNED_URL_TTL_SECONDS",
				5 * 60
			)
		)
	);
}

async function buildVisionImageUrl(attachment: PreparedMessageAttachment) {
	const deliveryMode = parseVisionImageDeliveryMode();
	if (
		attachment.storageProvider === "r2" &&
		(deliveryMode === "auto" || deliveryMode === "presigned_url")
	) {
		return getPresignedStoredFileUrl(
			{
				storageProvider: attachment.storageProvider,
				storageKey: attachment.storageKey,
			},
			getVisionImagePresignedUrlTtlSeconds()
		);
	}

	if (deliveryMode === "presigned_url") {
		throw new AttachmentValidationError(
			"Presigned image delivery requires R2-backed storage.",
			"VISION_IMAGE_PRESIGNED_URL_UNSUPPORTED",
			500
		);
	}

	const buffer = await readStoredFileObject({
		storageProvider: attachment.storageProvider,
		storageKey: attachment.storageKey,
	});

	return toDataUrl({
		mimeType: attachment.mimeType,
		buffer,
	});
}

export async function buildVisionContentParts(
	attachments: PreparedMessageAttachment[]
): Promise<ProviderContentPart[]> {
	const imageAttachments = attachments.filter(
		(attachment) => attachment.promptUse === "vision"
	);
	if (imageAttachments.length === 0) {
		return [];
	}

	return Promise.all(
		imageAttachments.map(async (attachment) => {
			return {
				type: "image_url" as const,
				imageUrl: await buildVisionImageUrl(attachment),
			};
		})
	);
}

export function applyVisionAttachmentsToLastUserMessage({
	messages,
	imageParts,
}: {
	messages: ProviderMessage[];
	imageParts: ProviderContentPart[];
}) {
	if (imageParts.length === 0) {
		return messages;
	}

	const nextMessages = [...messages];
	for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
		const message = nextMessages[index];
		if (message.role !== "user") continue;

		const text =
			typeof message.content === "string"
				? message.content
				: message.content
						.filter((part) => part.type === "text")
						.map((part) => part.text)
						.join("\n");

		nextMessages[index] = {
			...message,
			content: [
				{
					type: "text",
					text,
				},
				...imageParts,
			],
		};
		return nextMessages;
	}

	return nextMessages;
}

export function serializeAttachmentForClient(attachment: {
	id?: string;
	fileObjectId?: string;
	kind: string;
	promptUse?: string;
	displayOrder?: number;
	fileObject?: {
		id: string;
		filename: string;
		mimeType: string;
		sizeBytes: number;
		status: string;
		kind: string;
		purpose: string;
	};
}) {
	const fileObject = attachment.fileObject;
	return {
		id: attachment.id ?? fileObject?.id ?? attachment.fileObjectId,
		fileObjectId: attachment.fileObjectId ?? fileObject?.id,
		kind: attachment.kind,
		promptUse: attachment.promptUse,
		displayOrder: attachment.displayOrder ?? 0,
		filename: fileObject?.filename,
		mimeType: fileObject?.mimeType,
		sizeBytes: fileObject?.sizeBytes,
		status: fileObject?.status,
		fileKind: fileObject?.kind,
		purpose: fileObject?.purpose,
	};
}

export function serializeFileObjectForAttachmentClient(file: {
	id: string;
	filename: string;
	mimeType: string;
	kind: string;
	purpose: string;
	sizeBytes: number;
	status: string;
	chunkCount?: number | null;
	errorCode?: string | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	processedAt?: Date | string | null;
}) {
	return {
		id: file.id,
		fileObjectId: file.id,
		filename: file.filename,
		mimeType: file.mimeType,
		kind: file.kind === "image" ? "image" : "document",
		fileKind: file.kind,
		purpose: file.purpose,
		sizeBytes: file.sizeBytes,
		status: file.status,
		chunkCount: file.chunkCount ?? 0,
		errorCode: file.errorCode ?? null,
		contentUrl:
			file.kind === "image"
				? `/api/attachments/${file.id}/content`
				: null,
		createdAt: file.createdAt ?? null,
		updatedAt: file.updatedAt ?? null,
		processedAt: file.processedAt ?? null,
	};
}
