import type { RetrievedDocumentContext } from "@/lib/rag/retrieval";

export interface RerankInput {
	query: string;
	chunks: RetrievedDocumentContext[];
}

export interface Reranker {
	readonly name: string;
	rerank(_input: RerankInput): Promise<RetrievedDocumentContext[]>;
}

export class NoopReranker implements Reranker {
	readonly name = "noop-reranker-v1";

	async rerank({ chunks }: RerankInput) {
		return chunks;
	}
}
