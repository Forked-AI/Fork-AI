import {
	assertEmbeddingVector,
	type EmbeddingProvider,
	type EmbeddingVector,
} from "@/lib/rag/embedding-provider";
import { mistralClient } from "@/lib/models";

const DEFAULT_MISTRAL_EMBEDDING_MODEL = "mistral-embed";
const DEFAULT_MISTRAL_EMBEDDING_DIMENSIONS = 1024;
const DEFAULT_MISTRAL_EMBEDDING_VERSION = "mistral-embed-v1";

interface MistralEmbeddingClientLike {
	embeddings?: {
		create(_request: {
			model: string;
			inputs?: string[];
			input?: string[];
			outputDimension?: number;
		}): Promise<{
			data?: Array<{
				embedding?: number[];
			}>;
		}>;
	};
}

function getConfiguredDimensions() {
	const configured = Number(process.env.RAG_EMBEDDING_DIMENSIONS);
	return Number.isInteger(configured) && configured > 0
		? configured
		: DEFAULT_MISTRAL_EMBEDDING_DIMENSIONS;
}

export class MistralEmbeddingProvider implements EmbeddingProvider {
	readonly provider = "mistral";
	readonly model: string;
	readonly dimensions: number;
	readonly version: string;
	readonly cost = {
		unit: "tokens" as const,
		inputCostPerMillionUnitsUsd: undefined,
	};

	private readonly client: MistralEmbeddingClientLike;

	constructor(
		client: MistralEmbeddingClientLike = mistralClient as unknown as MistralEmbeddingClientLike,
		{
			model = process.env.MISTRAL_EMBEDDING_MODEL?.trim() ||
				DEFAULT_MISTRAL_EMBEDDING_MODEL,
			dimensions = getConfiguredDimensions(),
			version = process.env.RAG_EMBEDDING_VERSION?.trim() ||
				DEFAULT_MISTRAL_EMBEDDING_VERSION,
		}: {
			model?: string;
			dimensions?: number;
			version?: string;
		} = {}
	) {
		this.client = client;
		this.model = model;
		this.dimensions = dimensions;
		this.version = version;
	}

	async embedText(text: string): Promise<EmbeddingVector> {
		if (!this.client.embeddings?.create) {
			throw new Error("Mistral embeddings API is not available");
		}

		const response = await this.client.embeddings.create({
			model: this.model,
			inputs: [text],
			outputDimension: this.dimensions,
		});
		const vector = response.data?.[0]?.embedding;

		if (!Array.isArray(vector)) {
			throw new Error(
				"Mistral embeddings response did not include a vector"
			);
		}

		const embedding = {
			provider: this.provider,
			model: this.model,
			dimensions: this.dimensions,
			version: this.version,
			cost: this.cost,
			vector,
		};
		assertEmbeddingVector(embedding, {
			provider: this.provider,
			model: this.model,
			dimensions: this.dimensions,
			version: this.version,
		});
		return embedding;
	}
}
