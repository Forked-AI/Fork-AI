import {
	conversationTitleOutputSchema,
	shareSummaryOutputSchema,
} from "@/lib/ai/output-validation/contracts";
import { validateCitationSupport } from "@/lib/ai/output-validation/citations";
import { validateMarkdownSafety } from "@/lib/ai/output-validation/markdown";
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
});
