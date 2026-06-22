export type RetrievalMatchSource = "semantic" | "lexical" | "hybrid";

export interface ScoredRetrievalCandidate {
	chunkId: string;
	score: number;
	matchSource: RetrievalMatchSource;
}

export const MIN_RETRIEVAL_EVIDENCE_SCORE = 0.2;
export const MIN_SINGLE_SOURCE_SCORE = 0.35;
export const RELATIVE_SINGLE_SOURCE_SCORE_RATIO = 0.55;

export function filterWeakRetrievalCandidates<
	Candidate extends ScoredRetrievalCandidate,
>(candidates: Candidate[]) {
	if (candidates.length === 0) return candidates;

	const topScore = Math.max(
		...candidates.map((candidate) => candidate.score)
	);
	if (topScore < MIN_RETRIEVAL_EVIDENCE_SCORE) {
		return [];
	}

	const singleSourceThreshold = Math.max(
		MIN_SINGLE_SOURCE_SCORE,
		topScore * RELATIVE_SINGLE_SOURCE_SCORE_RATIO
	);

	return candidates.filter((candidate) => {
		if (candidate.matchSource === "hybrid") return true;
		return candidate.score >= singleSourceThreshold;
	});
}
