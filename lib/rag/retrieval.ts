import {
	cosineSimilarity,
	LocalHashEmbeddingProvider,
	parseVectorJson,
	type EmbeddingProvider,
} from "@/lib/rag/embedding-provider";
import {
	retrieveWithPgvector,
	type RagVectorSearchMode,
} from "@/lib/rag/pgvector";
import { prisma } from "@/lib/prisma";

export interface RagCitation {
	index: number;
	chunkId: string;
	fileId: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
}

export interface RetrievedDocumentContext {
	chunkId: string;
	fileId: string;
	content: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
}

export interface RetrieveDocumentContextInput {
	userId: string;
	query: string;
	fileIds?: string[];
	limit?: number;
	organizationId?: string | null;
	prismaClient?: any;
	embeddingProvider?: EmbeddingProvider;
	vectorSearchMode?: RagVectorSearchMode;
}

const DEFAULT_RETRIEVAL_LIMIT = 4;
const MAX_RETRIEVAL_LIMIT = 8;

function uniqueValues(values: string[] | undefined) {
	return [
		...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
	];
}

function assertPermissionFilter(userId: string) {
	if (!userId.trim()) {
		throw new Error("RAG retrieval requires a userId permission filter");
	}
}

export async function retrieveDocumentContext({
	userId,
	query,
	fileIds,
	limit = DEFAULT_RETRIEVAL_LIMIT,
	organizationId = null,
	prismaClient = prisma,
	embeddingProvider = new LocalHashEmbeddingProvider(),
	vectorSearchMode,
}: RetrieveDocumentContextInput): Promise<RetrievedDocumentContext[]> {
	assertPermissionFilter(userId);

	const normalizedQuery = query.trim();
	if (!normalizedQuery) {
		return [];
	}

	const requestedFileIds = uniqueValues(fileIds);
	const take = Math.min(Math.max(1, limit), MAX_RETRIEVAL_LIMIT);
	const queryEmbedding = await embeddingProvider.embedText(normalizedQuery);
	const pgvectorRows = await retrieveWithPgvector({
		prismaClient,
		userId,
		organizationId,
		fileIds: requestedFileIds,
		queryVector: queryEmbedding.vector,
		limit: take,
		mode: vectorSearchMode,
	});

	if (pgvectorRows) {
		return pgvectorRows.map((row) => ({
			chunkId: row.chunkId,
			fileId: row.fileId,
			content: row.content,
			sourceLabel: row.sourceLabel,
			pageNumber: row.pageNumber ?? null,
			score: Number(row.score),
		}));
	}

	const where: Record<string, unknown> = {
		userId,
		file: {
			status: "ready",
		},
	};

	if (organizationId) {
		where.organizationId = organizationId;
	}

	if (requestedFileIds.length > 0) {
		where.fileId = { in: requestedFileIds };
	}

	const chunks = await prismaClient.documentChunk.findMany({
		where,
		take: 200,
		orderBy: [{ fileId: "asc" }, { chunkIndex: "asc" }],
		select: {
			id: true,
			fileId: true,
			content: true,
			sourceLabel: true,
			pageNumber: true,
			embedding: {
				select: {
					vectorJson: true,
				},
			},
		},
	});

	return chunks
		.map((chunk: any) => ({
			chunkId: chunk.id,
			fileId: chunk.fileId,
			content: chunk.content,
			sourceLabel: chunk.sourceLabel,
			pageNumber: chunk.pageNumber ?? null,
			score: chunk.embedding?.vectorJson
				? cosineSimilarity(
						queryEmbedding.vector,
						parseVectorJson(chunk.embedding.vectorJson)
					)
				: 0,
		}))
		.sort(
			(
				left: RetrievedDocumentContext,
				right: RetrievedDocumentContext
			) => {
				if (right.score !== left.score) return right.score - left.score;
				return left.chunkId.localeCompare(right.chunkId);
			}
		)
		.slice(0, take);
}

export function buildRagCitations(
	chunks: RetrievedDocumentContext[]
): RagCitation[] {
	return chunks.map((chunk, index) => ({
		index: index + 1,
		chunkId: chunk.chunkId,
		fileId: chunk.fileId,
		sourceLabel: chunk.sourceLabel,
		pageNumber: chunk.pageNumber,
		score: Number(chunk.score.toFixed(6)),
	}));
}
