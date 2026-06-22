import type { RetrievedDocumentContext } from "@/lib/rag/retrieval";

export type RetrievalConfidenceLabel =
	| "high"
	| "medium"
	| "low"
	| "no_evidence";

export interface RetrievalConfidence {
	label: RetrievalConfidenceLabel;
	reason: string;
	topScore: number;
	evidenceCount: number;
}

export function estimateRetrievalConfidence(
	chunks: Array<Pick<RetrievedDocumentContext, "score">>
): RetrievalConfidence {
	const topScore = chunks[0]?.score ?? 0;
	const evidenceCount = chunks.filter((chunk) => chunk.score > 0.15).length;

	if (chunks.length === 0 || topScore <= 0) {
		return {
			label: "no_evidence",
			reason: "No permission-filtered document evidence matched the query.",
			topScore: 0,
			evidenceCount: 0,
		};
	}

	if (topScore >= 0.72 && evidenceCount >= 2) {
		return {
			label: "high",
			reason: "Multiple retrieved chunks strongly matched the query.",
			topScore,
			evidenceCount,
		};
	}

	if (topScore >= 0.48) {
		return {
			label: "medium",
			reason: "At least one retrieved chunk matched the query.",
			topScore,
			evidenceCount,
		};
	}

	return {
		label: "low",
		reason: "Retrieved evidence is weak; answers should stay cautious.",
		topScore,
		evidenceCount,
	};
}
