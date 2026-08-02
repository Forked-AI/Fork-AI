import {
	conversationTitleOutputSchema,
	shareSummaryOutputSchema,
} from "@/lib/ai/output-validation/contracts";
import { validateCitationSupport } from "@/lib/ai/output-validation/citations";
import { validateMarkdownSafety } from "@/lib/ai/output-validation/markdown";
import {
	validateFinalAssistantOutput,
	validateStreamingAssistantOutput,
} from "@/lib/ai/output-validation/runtime";
import { validateStructuredJsonText } from "@/lib/ai/output-validation/validator";
import { describe, expect, it } from "vitest";

describe("AI output validation", () => {
	it("accepts valid structured title and rejects malformed JSON", () => {
		expect(
			validateStructuredJsonText(
				conversationTitleOutputSchema,
				'{"title":"Retrieval Quality Planning"}'
			)
		).toMatchObject({
			ok: true,
			value: { title: "Retrieval Quality Planning" },
		});

		expect(
			validateStructuredJsonText(
				conversationTitleOutputSchema,
				'{"name":"Wrong field"}'
			)
		).toMatchObject({
			ok: false,
			status: "schema_invalid",
			errorCode: "AI_OUTPUT_SCHEMA_INVALID",
		});
	});

	it("validates share summary contracts", () => {
		expect(
			validateStructuredJsonText(
				shareSummaryOutputSchema,
				'{"overview":"Short summary","keyPoints":["One","Two"]}'
			).ok
		).toBe(true);
	});

	it("detects unsupported citations without storing raw content", () => {
		const result = validateCitationSupport({
			answerSentence: "Refunds are available for 90 days.",
			citedChunkId: "chunk-1",
			citedChunkContent:
				"Current plans have a 30 day refund window for eligible accounts.",
		});

		expect(result.verdict).not.toBe("supported");
		expect(result.answerHash).toHaveLength(24);
		expect(result.chunkHash).toHaveLength(24);
	});

	it("rejects unsafe markdown markers", () => {
		expect(validateMarkdownSafety("[docs](https://example.com)").ok).toBe(
			true
		);
		expect(
			validateMarkdownSafety("[x](javascript:alert(1))")
		).toMatchObject({
			ok: false,
			errorCode: "UNSAFE_MARKDOWN_OUTPUT",
		});
	});

	it("fails streaming output when unsafe markdown appears", () => {
		expect(
			validateStreamingAssistantOutput("[x](javascript:alert(1))")
		).toMatchObject({
			ok: false,
			status: "markdown_unsafe",
			errorCode: "UNSAFE_MARKDOWN_OUTPUT",
		});
	});

	it("requires cautious no-evidence answers for selected-file RAG", () => {
		expect(
			validateFinalAssistantOutput({
				answer: "The selected file says the refund window is 90 days.",
				ragEvidence: { requested: true, chunks: [] },
			})
		).toMatchObject({
			ok: false,
			status: "refusal_expected",
			errorCode: "UNSUPPORTED_QUESTION_NOT_REFUSED",
		});

		expect(
			validateFinalAssistantOutput({
				answer: "I do not have evidence for that in the selected files.",
				ragEvidence: { requested: true, chunks: [] },
			}).ok
		).toBe(true);
	});

	it("accepts RAG answers with lexical support in selected evidence", () => {
		expect(
			validateFinalAssistantOutput({
				answer: "Current plans have a 30 day refund window for eligible accounts.",
				ragEvidence: {
					requested: true,
					chunks: [
						{
							chunkId: "chunk-refund",
							sourceLabel: "policy.md",
							content:
								"Current plans have a 30 day refund window for eligible accounts.",
						},
					],
				},
			})
		).toMatchObject({
			ok: true,
			status: "valid",
			citationValidationFailureCount: 0,
		});
	});
});
