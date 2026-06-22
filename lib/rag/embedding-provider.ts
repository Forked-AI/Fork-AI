import { createHash } from "node:crypto";

export interface EmbeddingVector {
	provider: string;
	model: string;
	dimensions: number;
	version: string;
	cost?: {
		unit: "tokens" | "characters" | "request";
		inputCostPerMillionUnitsUsd?: number;
	};
	vector: number[];
}

export interface EmbeddingProvider {
	readonly provider: string;
	readonly model: string;
	readonly dimensions: number;
	readonly version: string;
	embedText(_text: string): Promise<EmbeddingVector>;
}

export const LOCAL_HASH_EMBEDDING_PROVIDER = "local";
export const LOCAL_HASH_EMBEDDING_MODEL = "feature-hash-v1";
export const LOCAL_HASH_EMBEDDING_VERSION = "local-hash-embedding-v1";
const DEFAULT_DIMENSIONS = 256;

function getDimensions() {
	const configured = Number(process.env.RAG_EMBEDDING_DIMENSIONS);
	return Number.isFinite(configured) && configured >= 64
		? Math.floor(configured)
		: DEFAULT_DIMENSIONS;
}

function tokenize(text: string) {
	return (
		text
			.toLowerCase()
			.match(/[a-z0-9_]{2,}/g)
			?.slice(0, 8_000) ?? []
	);
}

function hashToken(token: string) {
	const digest = createHash("sha256").update(token).digest();
	return {
		indexSeed: digest.readUInt32BE(0),
		signSeed: digest.readUInt32BE(4),
	};
}

export class LocalHashEmbeddingProvider implements EmbeddingProvider {
	readonly provider = LOCAL_HASH_EMBEDDING_PROVIDER;
	readonly model = LOCAL_HASH_EMBEDDING_MODEL;
	readonly version = LOCAL_HASH_EMBEDDING_VERSION;
	readonly dimensions: number;

	constructor(dimensions = getDimensions()) {
		this.dimensions = dimensions;
	}

	async embedText(text: string): Promise<EmbeddingVector> {
		const vector = new Array(this.dimensions).fill(0) as number[];

		for (const token of tokenize(text)) {
			const { indexSeed, signSeed } = hashToken(token);
			const index = indexSeed % this.dimensions;
			const sign = signSeed % 2 === 0 ? 1 : -1;
			vector[index] += sign;
		}

		const norm =
			Math.sqrt(
				vector.reduce((total, value) => total + value * value, 0)
			) || 1;

		return {
			provider: LOCAL_HASH_EMBEDDING_PROVIDER,
			model: LOCAL_HASH_EMBEDDING_MODEL,
			dimensions: this.dimensions,
			version: LOCAL_HASH_EMBEDDING_VERSION,
			vector: vector.map((value) => Number((value / norm).toFixed(8))),
		};
	}
}

export interface EmbeddingConfig {
	provider: string;
	model: string;
	dimensions: number;
	version: string;
}

export function assertEmbeddingVector(
	embedding: EmbeddingVector,
	expected: Partial<EmbeddingConfig> = {}
) {
	if (!embedding.provider.trim()) {
		throw new Error("Embedding provider is required");
	}
	if (!embedding.model.trim()) {
		throw new Error("Embedding model is required");
	}
	if (!Number.isInteger(embedding.dimensions) || embedding.dimensions <= 0) {
		throw new Error("Embedding dimensions must be a positive integer");
	}
	if (embedding.vector.length !== embedding.dimensions) {
		throw new Error(
			`Embedding vector dimension mismatch: expected ${embedding.dimensions}, received ${embedding.vector.length}`
		);
	}
	if (embedding.vector.some((value) => !Number.isFinite(value))) {
		throw new Error("Embedding vector contains non-finite values");
	}
	if (expected.provider && embedding.provider !== expected.provider) {
		throw new Error(
			`Embedding provider mismatch: expected ${expected.provider}, received ${embedding.provider}`
		);
	}
	if (expected.model && embedding.model !== expected.model) {
		throw new Error(
			`Embedding model mismatch: expected ${expected.model}, received ${embedding.model}`
		);
	}
	if (
		expected.dimensions !== undefined &&
		embedding.dimensions !== expected.dimensions
	) {
		throw new Error(
			`Embedding dimensions mismatch: expected ${expected.dimensions}, received ${embedding.dimensions}`
		);
	}
	if (expected.version && embedding.version !== expected.version) {
		throw new Error(
			`Embedding version mismatch: expected ${expected.version}, received ${embedding.version}`
		);
	}
}

export function getEmbeddingConfig(
	provider: EmbeddingProvider
): EmbeddingConfig {
	return {
		provider: provider.provider,
		model: provider.model,
		dimensions: provider.dimensions,
		version: provider.version,
	};
}

export async function createEmbeddingProviderFromEnv(): Promise<EmbeddingProvider> {
	const provider = process.env.RAG_EMBEDDING_PROVIDER?.trim().toLowerCase();
	if (!provider || provider === "local" || provider === "local-hash") {
		return new LocalHashEmbeddingProvider();
	}
	if (provider === "mistral") {
		const { MistralEmbeddingProvider } =
			await import("@/lib/rag/providers/mistral-embedding-provider");
		return new MistralEmbeddingProvider();
	}
	throw new Error(
		`Unsupported RAG_EMBEDDING_PROVIDER "${process.env.RAG_EMBEDDING_PROVIDER}"`
	);
}

export function serializeVector(vector: number[]) {
	return JSON.stringify(vector);
}

export function parseVectorJson(value: string): number[] {
	const parsed = JSON.parse(value) as unknown;
	if (!Array.isArray(parsed)) return [];
	return parsed.filter((entry): entry is number => typeof entry === "number");
}

export function cosineSimilarity(left: number[], right: number[]) {
	if (left.length !== right.length) {
		return 0;
	}
	const length = Math.min(left.length, right.length);
	let score = 0;

	for (let index = 0; index < length; index += 1) {
		score += left[index] * right[index];
	}

	return score;
}
