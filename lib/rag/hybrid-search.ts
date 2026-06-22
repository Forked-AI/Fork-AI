import {
	cosineSimilarity,
	parseVectorJson,
} from "@/lib/rag/embedding-provider";
import {
	retrieveWithPgvector,
	type PgvectorRetrievedRow,
} from "@/lib/rag/pgvector";

export interface HybridSearchInput {
	prismaClient: any;
	userId: string;
	organizationId: string | null;
	fileIds: string[];
	query: string;
	queryVector: number[];
	embeddingProvider: string;
	embeddingModel: string;
	embeddingDimensions: number;
	limit: number;
	vectorSearchMode?: "auto" | "pgvector" | "json";
}

export interface HybridCandidate {
	chunkId: string;
	fileId: string;
	content: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
	semanticScore: number;
	lexicalScore: number;
	matchSource: "semantic" | "lexical" | "hybrid";
}

const DENSE_WEIGHT = 0.72;
const LEXICAL_WEIGHT = 0.28;
const CANDIDATE_MULTIPLIER = 4;
const MAX_LEXICAL_SCAN = 500;

function tokenize(text: string) {
	return text.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? [];
}

function lexicalScore(query: string, content: string) {
	const queryTokens = new Set(tokenize(query));
	if (queryTokens.size === 0) return 0;

	const contentTokens = new Set(tokenize(content));
	let matched = 0;
	for (const token of queryTokens) {
		if (contentTokens.has(token)) matched += 1;
	}
	return matched / queryTokens.size;
}

function buildChunkWhere({
	userId,
	organizationId,
	fileIds,
}: Pick<HybridSearchInput, "userId" | "organizationId" | "fileIds">) {
	const where: Record<string, unknown> = {
		userId,
		organizationId,
		file: {
			status: "ready",
		},
	};

	if (fileIds.length > 0) {
		where.fileId = { in: fileIds };
	}

	return where;
}

function mapPgvectorRow(row: PgvectorRetrievedRow): HybridCandidate {
	const semanticScore = Number(row.score);
	return {
		chunkId: row.chunkId,
		fileId: row.fileId,
		content: row.content,
		sourceLabel: row.sourceLabel,
		pageNumber: row.pageNumber ?? null,
		score: semanticScore,
		semanticScore,
		lexicalScore: 0,
		matchSource: "semantic",
	};
}

async function retrieveDenseCandidates(input: HybridSearchInput) {
	const denseLimit = Math.max(
		input.limit * CANDIDATE_MULTIPLIER,
		input.limit
	);
	const pgvectorRows = await retrieveWithPgvector({
		prismaClient: input.prismaClient,
		userId: input.userId,
		organizationId: input.organizationId,
		fileIds: input.fileIds,
		queryVector: input.queryVector,
		embeddingProvider: input.embeddingProvider,
		embeddingModel: input.embeddingModel,
		limit: denseLimit,
		mode: input.vectorSearchMode,
	});

	if (pgvectorRows) {
		return pgvectorRows.map(mapPgvectorRow);
	}

	const chunks = await input.prismaClient.documentChunk.findMany({
		where: {
			...buildChunkWhere(input),
			embedding: {
				provider: input.embeddingProvider,
				model: input.embeddingModel,
				dimensions: input.embeddingDimensions,
			},
		},
		take: Math.max(200, denseLimit),
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

	return (chunks as any[])
		.map((chunk: any): HybridCandidate => {
			const semanticScore = chunk.embedding?.vectorJson
				? cosineSimilarity(
						input.queryVector,
						parseVectorJson(chunk.embedding.vectorJson)
					)
				: 0;
			return {
				chunkId: chunk.id,
				fileId: chunk.fileId,
				content: chunk.content,
				sourceLabel: chunk.sourceLabel,
				pageNumber: chunk.pageNumber ?? null,
				score: semanticScore,
				semanticScore,
				lexicalScore: 0,
				matchSource: "semantic",
			};
		})
		.sort(
			(left: HybridCandidate, right: HybridCandidate) =>
				right.semanticScore - left.semanticScore
		)
		.slice(0, denseLimit);
}

async function retrieveLexicalCandidates(input: HybridSearchInput) {
	const chunks = await input.prismaClient.documentChunk.findMany({
		where: buildChunkWhere(input),
		take: MAX_LEXICAL_SCAN,
		orderBy: [{ fileId: "asc" }, { chunkIndex: "asc" }],
		select: {
			id: true,
			fileId: true,
			content: true,
			sourceLabel: true,
			pageNumber: true,
		},
	});

	return (chunks as any[])
		.map((chunk: any): HybridCandidate => {
			const score = lexicalScore(input.query, chunk.content);
			return {
				chunkId: chunk.id,
				fileId: chunk.fileId,
				content: chunk.content,
				sourceLabel: chunk.sourceLabel,
				pageNumber: chunk.pageNumber ?? null,
				score,
				semanticScore: 0,
				lexicalScore: score,
				matchSource: "lexical",
			};
		})
		.filter((candidate: HybridCandidate) => candidate.lexicalScore > 0)
		.sort(
			(left: HybridCandidate, right: HybridCandidate) =>
				right.lexicalScore - left.lexicalScore
		)
		.slice(0, Math.max(input.limit * CANDIDATE_MULTIPLIER, input.limit));
}

function mergeCandidates(candidates: HybridCandidate[]) {
	const merged = new Map<string, HybridCandidate>();

	for (const candidate of candidates) {
		const existing = merged.get(candidate.chunkId);
		if (!existing) {
			merged.set(candidate.chunkId, { ...candidate });
			continue;
		}

		existing.semanticScore = Math.max(
			existing.semanticScore,
			candidate.semanticScore
		);
		existing.lexicalScore = Math.max(
			existing.lexicalScore,
			candidate.lexicalScore
		);
		existing.matchSource =
			existing.semanticScore > 0 && existing.lexicalScore > 0
				? "hybrid"
				: existing.semanticScore > 0
					? "semantic"
					: "lexical";
	}

	return [...merged.values()].map((candidate) => ({
		...candidate,
		score: Number(
			(candidate.semanticScore > 0 && candidate.lexicalScore > 0
				? candidate.semanticScore * DENSE_WEIGHT +
					candidate.lexicalScore * LEXICAL_WEIGHT
				: Math.max(candidate.semanticScore, candidate.lexicalScore)
			).toFixed(6)
		),
	}));
}

export async function retrieveHybridCandidates(input: HybridSearchInput) {
	const [denseCandidates, lexicalCandidates] = await Promise.all([
		retrieveDenseCandidates(input),
		retrieveLexicalCandidates(input),
	]);

	return mergeCandidates([...denseCandidates, ...lexicalCandidates]).sort(
		(left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			if (right.semanticScore !== left.semanticScore) {
				return right.semanticScore - left.semanticScore;
			}
			return left.chunkId.localeCompare(right.chunkId);
		}
	);
}
