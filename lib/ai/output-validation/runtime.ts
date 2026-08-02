import type { RetrievedDocumentContext } from "@/lib/rag/retrieval";
import {
	validateCitationSupport,
	validateUnsupportedQuestionRefusal,
	type CitationSupportVerdict,
} from "@/lib/ai/output-validation/citations";
import { validateMarkdownSafety } from "@/lib/ai/output-validation/markdown";
import type { OutputValidationStatus } from "@/lib/ai/output-validation/validator";

export interface RuntimeRagEvidence {
	requested: boolean;
	chunks: Array<
		Pick<RetrievedDocumentContext, "chunkId" | "content" | "sourceLabel">
	>;
}

export interface RuntimeOutputValidationResult {
	ok: boolean;
	status: OutputValidationStatus;
	errorCode?: string;
	message?: string;
	replacementContent?: string;
	issueCount: number;
	citationValidationFailureCount: number;
	citationVerdicts: Array<{
		chunkId: string;
		verdict: CitationSupportVerdict;
		overlapRatio: number;
	}>;
}

const OUTPUT_VALIDATION_RETRY_MESSAGE =
	"The response failed output validation. Please retry or narrow the requested context.";

const UNSUPPORTED_RAG_REPLACEMENT =
	"I could not verify an answer from the selected files. Please add a more specific source or ask me to answer without file evidence.";

function validResult(
	overrides: Partial<RuntimeOutputValidationResult> = {}
): RuntimeOutputValidationResult {
	return {
		ok: true,
		status: "valid",
		issueCount: 0,
		citationValidationFailureCount: 0,
		citationVerdicts: [],
		...overrides,
	};
}

function invalidResult(
	input: Omit<RuntimeOutputValidationResult, "ok">
): RuntimeOutputValidationResult {
	return {
		ok: false,
		...input,
	};
}

function splitSentences(answer: string) {
	return answer
		.split(/(?<=[.!?])\s+/)
		.map((sentence) => sentence.trim())
		.filter((sentence) => sentence.length >= 24);
}

function isCautiousNoEvidenceAnswer(answer: string) {
	return validateUnsupportedQuestionRefusal({
		answer,
		hasEvidence: false,
	}).ok;
}

export function validateStreamingAssistantOutput(
	answerSoFar: string
): RuntimeOutputValidationResult {
	const markdown = validateMarkdownSafety(answerSoFar);
	if (markdown.ok) return validResult();

	return invalidResult({
		status: "markdown_unsafe",
		errorCode: markdown.errorCode,
		message: OUTPUT_VALIDATION_RETRY_MESSAGE,
		replacementContent:
			"I could not safely return that response because it contained unsafe markdown.",
		issueCount: 1,
		citationValidationFailureCount: 0,
		citationVerdicts: [],
	});
}

export function validateFinalAssistantOutput({
	answer,
	ragEvidence,
}: {
	answer: string;
	ragEvidence: RuntimeRagEvidence;
}): RuntimeOutputValidationResult {
	const streamingValidation = validateStreamingAssistantOutput(answer);
	if (!streamingValidation.ok) return streamingValidation;

	if (ragEvidence.requested && ragEvidence.chunks.length === 0) {
		const refusal = validateUnsupportedQuestionRefusal({
			answer,
			hasEvidence: false,
		});
		if (!refusal.ok) {
			return invalidResult({
				status: "refusal_expected",
				errorCode: refusal.errorCode,
				message: OUTPUT_VALIDATION_RETRY_MESSAGE,
				replacementContent: UNSUPPORTED_RAG_REPLACEMENT,
				issueCount: 1,
				citationValidationFailureCount: 0,
				citationVerdicts: [],
			});
		}
		return validResult();
	}

	if (ragEvidence.chunks.length === 0 || isCautiousNoEvidenceAnswer(answer)) {
		return validResult();
	}

	const sentences = splitSentences(answer);
	if (sentences.length === 0) return validResult();

	const verdicts = sentences.map((sentence) => {
		const results = ragEvidence.chunks.map((chunk) => ({
			chunkId: chunk.chunkId,
			result: validateCitationSupport({
				answerSentence: sentence,
				citedChunkId: chunk.chunkId,
				citedChunkContent: chunk.content,
			}),
		}));
		const strongest = results.sort((left, right) => {
			const rank = {
				supported: 3,
				partially_supported: 2,
				unsupported: 1,
			};
			const rankDelta =
				rank[right.result.verdict] - rank[left.result.verdict];
			return (
				rankDelta ||
				right.result.overlapRatio - left.result.overlapRatio
			);
		})[0];

		return {
			chunkId: strongest?.chunkId ?? "unknown",
			verdict: strongest?.result.verdict ?? "unsupported",
			overlapRatio: strongest?.result.overlapRatio ?? 0,
		};
	});

	const unsupported = verdicts.filter(
		(verdict) => verdict.verdict === "unsupported"
	);

	if (unsupported.length === sentences.length) {
		return invalidResult({
			status: "citation_unsupported",
			errorCode: "AI_CITATION_UNSUPPORTED",
			message: OUTPUT_VALIDATION_RETRY_MESSAGE,
			replacementContent:
				"I could not verify that answer against the selected file evidence.",
			issueCount: unsupported.length,
			citationValidationFailureCount: unsupported.length,
			citationVerdicts: verdicts,
		});
	}

	return validResult({
		status: unsupported.length > 0 ? "citation_unsupported" : "valid",
		issueCount: unsupported.length,
		citationValidationFailureCount: unsupported.length,
		citationVerdicts: verdicts,
	});
}
