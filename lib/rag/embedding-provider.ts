import { createHash } from "node:crypto";

export interface EmbeddingVector {
	provider: string;
	model: string;
	dimensions: number;
	vector: number[];
}

export interface EmbeddingProvider {
	embedText(_text: string): Promise<EmbeddingVector>;
}

export const LOCAL_HASH_EMBEDDING_PROVIDER = "local";
export const LOCAL_HASH_EMBEDDING_MODEL = "feature-hash-v1";
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
	private readonly dimensions: number;

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
			vector: vector.map((value) => Number((value / norm).toFixed(8))),
		};
	}
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
	const length = Math.min(left.length, right.length);
	let score = 0;

	for (let index = 0; index < length; index += 1) {
		score += left[index] * right[index];
	}

	return score;
}
