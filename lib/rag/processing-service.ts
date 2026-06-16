import { prisma } from "@/lib/prisma";
import { chunkDocumentText } from "@/lib/rag/chunking";
import {
	LocalHashEmbeddingProvider,
	serializeVector,
	type EmbeddingProvider,
} from "@/lib/rag/embedding-provider";
import {
	extractTextFromFile,
	TextExtractionError,
} from "@/lib/rag/text-extractors";
import { writeEmbeddingPgvector } from "@/lib/rag/pgvector";
import { readStoredFileObject } from "@/lib/rag/storage";
import { logServerInfo, logServerWarning } from "@/lib/server-safe-log";

export interface ProcessUploadedFileInput {
	fileId: string;
	userId: string;
	prismaClient?: any;
	embeddingProvider?: EmbeddingProvider;
}

function getErrorCode(error: unknown) {
	return error instanceof TextExtractionError
		? error.errorCode
		: "FILE_PROCESSING_FAILED";
}

function getSafeErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message.slice(0, 300);
	}

	return "File processing failed.";
}

export async function processUploadedFile({
	fileId,
	userId,
	prismaClient = prisma,
	embeddingProvider = new LocalHashEmbeddingProvider(),
}: ProcessUploadedFileInput) {
	const file = await prismaClient.fileObject.findFirst({
		where: {
			id: fileId,
			userId,
			status: { in: ["uploaded", "failed"] },
		},
	});

	if (!file) {
		throw new Error("Uploaded file was not found or is not processable");
	}

	await prismaClient.fileObject.updateMany({
		where: { id: fileId, userId },
		data: {
			status: "processing",
			errorCode: null,
			errorMessage: null,
		},
	});

	try {
		const buffer = await readStoredFileObject({
			storageProvider: file.storageProvider,
			storageKey: file.storageKey,
		});
		const extracted = await extractTextFromFile({
			buffer,
			filename: file.filename,
			kind:
				file.extension === ".pdf"
					? "pdf"
					: file.extension === ".csv"
						? "csv"
						: file.extension === ".md" ||
							  file.extension === ".markdown"
							? "markdown"
							: "text",
		});
		const chunks = chunkDocumentText({
			fileId,
			text: extracted.text,
			sourceLabel: file.filename,
			pageCount: extracted.pageCount,
		});

		if (chunks.length === 0) {
			throw new TextExtractionError(
				"No searchable chunks were produced.",
				"FILE_CHUNKS_EMPTY"
			);
		}

		const embeddedChunks = await Promise.all(
			chunks.map(async (chunk) => ({
				chunk,
				embedding: await embeddingProvider.embedText(chunk.content),
			}))
		);
		const parsedTextBytes = Buffer.byteLength(extracted.text, "utf8");
		const processedAt = new Date();

		await prismaClient.$transaction(async (transaction: any) => {
			await transaction.documentChunk.deleteMany({
				where: { fileId, userId },
			});

			for (const { chunk, embedding } of embeddedChunks) {
				await transaction.documentChunk.create({
					data: {
						id: chunk.id,
						fileId,
						userId,
						organizationId: file.organizationId ?? null,
						chunkIndex: chunk.chunkIndex,
						content: chunk.content,
						contentHash: chunk.contentHash,
						pageNumber: chunk.pageNumber,
						sourceLabel: chunk.sourceLabel,
						permissionScope: "user",
						embedding: {
							create: {
								userId,
								organizationId: file.organizationId ?? null,
								provider: embedding.provider,
								model: embedding.model,
								dimensions: embedding.dimensions,
								vectorJson: serializeVector(embedding.vector),
							},
						},
					},
				});

				await writeEmbeddingPgvector({
					prismaClient: transaction,
					chunkId: chunk.id,
					vector: embedding.vector,
				});
			}

			await transaction.fileObject.update({
				where: { id: fileId },
				data: {
					status: "ready",
					errorCode: null,
					errorMessage: null,
					parsedTextBytes,
					chunkCount: embeddedChunks.length,
					processedAt,
				},
			});
		});

		logServerInfo("rag/file-processing", "file_ready", {
			fileId,
			userId,
			chunkCount: embeddedChunks.length,
		});

		return {
			fileId,
			status: "ready" as const,
			chunkCount: embeddedChunks.length,
			parsedTextBytes,
		};
	} catch (error) {
		await prismaClient.fileObject.updateMany({
			where: { id: fileId, userId },
			data: {
				status: "failed",
				errorCode: getErrorCode(error),
				errorMessage: getSafeErrorMessage(error),
				processedAt: new Date(),
			},
		});

		logServerWarning("rag/file-processing", "file_failed", {
			fileId,
			userId,
			errorCode: getErrorCode(error),
		});

		throw error;
	}
}
