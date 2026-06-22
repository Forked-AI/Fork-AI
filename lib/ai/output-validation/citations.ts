import { contentFingerprint } from "@/lib/ai/output-validation/validator";

export type CitationSupportVerdict =
	| "supported"
	| "partially_supported"
	| "unsupported";

export interface CitationSupportInput {
	answerSentence: string;
	citedChunkId: string;
	citedChunkContent: string;
}

export interface CitationSupportResult {
	verdict: CitationSupportVerdict;
	unsupportedReason?: string;
	answerHash: string;
	chunkHash: string;
	overlapRatio: number;
}

const STOP_WORDS = new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"to",
	"of",
	"in",
	"for",
	"is",
	"are",
	"was",
	"were",
	"with",
	"that",
	"this",
	"it",
	"on",
	"by",
	"as",
]);

function tokens(value: string) {
	return value
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function validateCitationSupport(
	input: CitationSupportInput
): CitationSupportResult {
	const answerTokens = tokens(input.answerSentence);
	const chunkTokens = new Set(tokens(input.citedChunkContent));
	const overlap = answerTokens.filter((token) => chunkTokens.has(token));
	const overlapRatio = answerTokens.length
		? overlap.length / answerTokens.length
		: 0;

	if (!input.citedChunkContent.trim()) {
		return {
			verdict: "unsupported",
			unsupportedReason: "Cited chunk is empty or unavailable.",
			answerHash: contentFingerprint(input.answerSentence),
			chunkHash: contentFingerprint(input.citedChunkContent),
			overlapRatio,
		};
	}

	if (overlapRatio >= 0.45 || overlap.length >= 5) {
		return {
			verdict: "supported",
			answerHash: contentFingerprint(input.answerSentence),
			chunkHash: contentFingerprint(input.citedChunkContent),
			overlapRatio,
		};
	}

	if (overlapRatio >= 0.2 || overlap.length >= 2) {
		return {
			verdict: "partially_supported",
			unsupportedReason:
				"Only part of the answer sentence is supported by the cited chunk.",
			answerHash: contentFingerprint(input.answerSentence),
			chunkHash: contentFingerprint(input.citedChunkContent),
			overlapRatio,
		};
	}

	return {
		verdict: "unsupported",
		unsupportedReason:
			"The answer sentence has too little lexical support in the cited chunk.",
		answerHash: contentFingerprint(input.answerSentence),
		chunkHash: contentFingerprint(input.citedChunkContent),
		overlapRatio,
	};
}

export function validateUnsupportedQuestionRefusal(input: {
	answer: string;
	hasEvidence: boolean;
}) {
	if (input.hasEvidence) return { ok: true as const };
	const cautious =
		/\b(do not have|don't have|no evidence|not enough evidence|cannot determine|need a source)\b/i.test(
			input.answer
		);
	return cautious
		? { ok: true as const }
		: {
				ok: false as const,
				errorCode: "UNSUPPORTED_QUESTION_NOT_REFUSED",
			};
}
