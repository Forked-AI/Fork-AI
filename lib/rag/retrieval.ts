import {
	assertEmbeddingVector,
	createEmbeddingProviderFromEnv,
	type EmbeddingProvider,
} from "@/lib/rag/embedding-provider";
import { retrieveHybridCandidates } from "@/lib/rag/hybrid-search";
import { filterWeakRetrievalCandidates } from "@/lib/rag/retrieval-filter";
import type { RagVectorSearchMode } from "@/lib/rag/pgvector";
import { prisma } from "@/lib/prisma";
import {
	estimateRetrievalConfidence,
	type RetrievalConfidence,
} from "@/lib/rag/retrieval-confidence";
import { NoopReranker, type Reranker } from "@/lib/rag/reranker";

export interface RagCitation {
	index: number;
	chunkId: string;
	fileId: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
	confidence: RetrievalConfidence["label"];
	attribution: RetrievedDocumentContext["attribution"];
}

export interface RetrievedDocumentContext {
	chunkId: string;
	fileId: string;
	content: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
	confidence: RetrievalConfidence["label"];
	scoreBreakdown: {
		semantic: number;
		lexical: number;
		rerank: number | null;
	};
	attribution: {
		provider: string;
		model: string;
		dimensions: number;
		matchSource: "semantic" | "lexical" | "hybrid";
	};
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
	reranker?: Reranker;
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
	embeddingProvider,
	vectorSearchMode,
	reranker = new NoopReranker(),
}: RetrieveDocumentContextInput): Promise<RetrievedDocumentContext[]> {
	assertPermissionFilter(userId);

	const normalizedQuery = query.trim();
	if (!normalizedQuery) {
		return [];
	}

	const requestedFileIds = uniqueValues(fileIds);
	const take = Math.min(Math.max(1, limit), MAX_RETRIEVAL_LIMIT);
	const provider =
		embeddingProvider ?? (await createEmbeddingProviderFromEnv());
	const queryEmbedding = await provider.embedText(normalizedQuery);
	assertEmbeddingVector(queryEmbedding, {
		provider: provider.provider,
		model: provider.model,
		dimensions: provider.dimensions,
		version: provider.version,
	});

	const candidates = await retrieveHybridCandidates({
		prismaClient,
		userId,
		organizationId,
		fileIds: requestedFileIds,
		query: normalizedQuery,
		queryVector: queryEmbedding.vector,
		embeddingProvider: queryEmbedding.provider,
		embeddingModel: queryEmbedding.model,
		embeddingDimensions: queryEmbedding.dimensions,
		limit: take,
		vectorSearchMode,
	});

	const filteredCandidates = filterWeakRetrievalCandidates(candidates);
	const confidence = estimateRetrievalConfidence(filteredCandidates);
	const ranked = await reranker.rerank({
		query: normalizedQuery,
		chunks: filteredCandidates.map((candidate) => ({
			chunkId: candidate.chunkId,
			fileId: candidate.fileId,
			content: candidate.content,
			sourceLabel: candidate.sourceLabel,
			pageNumber: candidate.pageNumber ?? null,
			score: candidate.score,
			confidence: confidence.label,
			scoreBreakdown: {
				semantic: Number(candidate.semanticScore.toFixed(6)),
				lexical: Number(candidate.lexicalScore.toFixed(6)),
				rerank: null,
			},
			attribution: {
				provider: queryEmbedding.provider,
				model: queryEmbedding.model,
				dimensions: queryEmbedding.dimensions,
				matchSource: candidate.matchSource,
			},
		})),
	});

	return ranked.slice(0, take);
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
		confidence: chunk.confidence,
		attribution: chunk.attribution,
	}));
}
