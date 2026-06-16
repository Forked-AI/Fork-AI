import {
	sanitizeToolResult,
	summarizeStoredToolResult,
} from "@/lib/tools/sanitizer";
import { describe, expect, it } from "vitest";

describe("tool result sanitizer", () => {
	it("bounds metadata and redacts prompt-visible secret fields", () => {
		const result = sanitizeToolResult("safe.tool", {
			displayText: "Visible untrusted evidence",
			metadata: {
				provider: "example",
				authorization: "Bearer secret",
				contentSnippet: "private duplicated content",
				nested: {
					apiToken: "secret-token",
					label: "x".repeat(800),
				},
			},
		}) as Record<string, unknown>;

		expect(result.metadata).toEqual({
			provider: "example",
			authorization: "[redacted]",
			contentSnippet: "[redacted]",
			nested: {
				apiToken: "[redacted]",
				label: `${"x".repeat(500)}...`,
			},
		});
	});

	it("builds an operator-safe summary without returning display text", () => {
		const summary = summarizeStoredToolResult({
			untrusted: true,
			truncated: false,
			displayText: "private tool output",
			metadata: {
				provider: "tavily",
				resultCount: 2,
				requestId: "internal-request-id",
			},
		});

		expect(summary).toEqual({
			present: true,
			untrusted: true,
			truncated: false,
			displayTextLength: 19,
			metadata: {
				provider: "tavily",
				resultCount: 2,
			},
		});
		expect(summary).not.toHaveProperty("displayText");
	});
});
