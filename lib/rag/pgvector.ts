import { logServerWarning } from "@/lib/server-safe-log";

export type RagVectorSearchMode = "auto" | "pgvector" | "json";

export interface PgvectorRetrievedRow {
	chunkId: string;
	fileId: string;
	content: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
}

const MAX_INDEXED_VECTOR_DIMENSIONS = 2_000;

export function getRagVectorSearchMode(): RagVectorSearchMode {
	const configured = process.env.RAG_VECTOR_SEARCH_MODE?.trim().toLowerCase();
	return configured === "pgvector" || configured === "json"
		? configured
		: "auto";
}

function normalizeDimension(dimensions: number) {
	if (
		!Number.isInteger(dimensions) ||
		dimensions <= 0 ||
		dimensions > MAX_INDEXED_VECTOR_DIMENSIONS
	) {
		throw new Error("Invalid embedding dimensions for pgvector search");
	}

	return dimensions;
}

export function toPgvectorLiteral(vector: number[]) {
	if (vector.length === 0) {
		throw new Error("Cannot serialize an empty embedding vector");
	}

	return `[${vector
		.map((value) => {
			if (!Number.isFinite(value)) {
				throw new Error(
					"Cannot serialize a non-finite embedding value"
				);
			}
			return Number(value).toString();
		})
		.join(",")}]`;
}

function hasRawQueryClient(prismaClient: any) {
	return typeof prismaClient?.$queryRawUnsafe === "function";
}

function hasRawExecuteClient(prismaClient: any) {
	return typeof prismaClient?.$executeRawUnsafe === "function";
}

function isPgvectorUnavailable(error: unknown) {
	if (!error || typeof error !== "object") return false;
	const code =
		"code" in error ? String((error as { code?: unknown }).code) : "";
	const message =
		"message" in error
			? String((error as { message?: unknown }).message).toLowerCase()
			: "";

	return (
		["42703", "42704", "42883", "58P01"].includes(code) ||
		message.includes("vector_pg") ||
		message.includes('type "vector"') ||
		message.includes("operator does not exist") ||
		message.includes("extension vector")
	);
}

export async function writeEmbeddingPgvector({
	prismaClient,
	chunkId,
	vector,
	mode = getRagVectorSearchMode(),
}: {
	prismaClient: any;
	chunkId: string;
	vector: number[];
	mode?: RagVectorSearchMode;
}) {
	if (mode === "json" || !hasRawExecuteClient(prismaClient)) {
		return false;
	}

	const vectorLiteral = toPgvectorLiteral(vector);

	try {
		await prismaClient.$executeRawUnsafe(
			`UPDATE "embedding"
			 SET "vector_pg" = $1::vector
			 WHERE "chunkId" = $2`,
			vectorLiteral,
			chunkId
		);
		return true;
	} catch (error) {
		if (mode === "pgvector" || !isPgvectorUnavailable(error)) {
			throw error;
		}

		logServerWarning("rag/pgvector", "write_unavailable", {
			chunkId,
		});
		return false;
	}
}

export async function retrieveWithPgvector({
	prismaClient,
	userId,
	organizationId,
	fileIds,
	queryVector,
	embeddingProvider,
	embeddingModel,
	limit,
	mode = getRagVectorSearchMode(),
}: {
	prismaClient: any;
	userId: string;
	organizationId?: string | null;
	fileIds: string[];
	queryVector: number[];
	embeddingProvider: string;
	embeddingModel: string;
	limit: number;
	mode?: RagVectorSearchMode;
}): Promise<PgvectorRetrievedRow[] | null> {
	if (mode === "json" || !hasRawQueryClient(prismaClient)) {
		return null;
	}

	const dimensions = normalizeDimension(queryVector.length);
	const vectorLiteral = toPgvectorLiteral(queryVector);
	const params: unknown[] = [
		vectorLiteral,
		userId,
		dimensions,
		embeddingProvider,
		embeddingModel,
	];
	const conditions = [
		`dc."userId" = $2`,
		`f."userId" = $2`,
		`f."status" = 'ready'`,
		`e."dimensions" = $3`,
		`e."provider" = $4`,
		`e."model" = $5`,
		`e."vector_pg" IS NOT NULL`,
	];

	if (organizationId) {
		params.push(organizationId);
		conditions.push(`dc."organizationId" = $${params.length}`);
		conditions.push(`f."organizationId" = $${params.length}`);
	} else {
		conditions.push(`dc."organizationId" IS NULL`);
		conditions.push(`f."organizationId" IS NULL`);
	}

	if (fileIds.length > 0) {
		params.push(fileIds);
		conditions.push(`dc."fileId" = ANY($${params.length}::text[])`);
	}

	params.push(limit);
	const limitPlaceholder = `$${params.length}`;
	const vectorExpression = `e."vector_pg"::vector(${dimensions})`;
	const queryExpression = `$1::vector(${dimensions})`;

	const sql = `
		SELECT
			dc."id" AS "chunkId",
			dc."fileId" AS "fileId",
			dc."content" AS "content",
			dc."sourceLabel" AS "sourceLabel",
			dc."pageNumber" AS "pageNumber",
			(1 - (${vectorExpression} <=> ${queryExpression}))::float8 AS "score"
		FROM "document_chunk" dc
		INNER JOIN "embedding" e ON e."chunkId" = dc."id"
		INNER JOIN "file_object" f ON f."id" = dc."fileId"
		WHERE ${conditions.join(" AND ")}
		ORDER BY (${vectorExpression} <=> ${queryExpression}) ASC, dc."id" ASC
		LIMIT ${limitPlaceholder}
	`;

	try {
		return (await prismaClient.$queryRawUnsafe(
			sql,
			...params
		)) as PgvectorRetrievedRow[];
	} catch (error) {
		if (mode === "pgvector" || !isPgvectorUnavailable(error)) {
			throw error;
		}

		logServerWarning("rag/pgvector", "retrieve_unavailable", {
			userId,
			dimensions,
			embeddingProvider,
			embeddingModel,
		});
		return null;
	}
}
