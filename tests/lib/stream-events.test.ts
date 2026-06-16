import {
	buildChatStreamReplayResponse,
	encodeSseEvent,
	toJsonValue,
} from "@/lib/ai/stream-events";
import { describe, expect, it } from "vitest";

function parseSseEvents(text: string): Array<Record<string, unknown>> {
	return text
		.split(/\r?\n\r?\n/)
		.map((block) =>
			block.split(/\r?\n/).find((line) => line.startsWith("data: "))
		)
		.filter((line): line is string => Boolean(line))
		.map((line) => line.slice(6))
		.map((payload) => JSON.parse(payload) as Record<string, unknown>);
}

describe("stream events", () => {
	it("serializes SSE data events", () => {
		expect(
			encodeSseEvent({
				type: "content",
				content: "Hello",
			})
		).toBe('data: {"type":"content","content":"Hello"}\n\n');
	});

	it("replays successful stored chat streams with stable event names", async () => {
		const response = buildChatStreamReplayResponse(
			toJsonValue({
				kind: "chat_stream",
				conversationId: "conversation-1",
				userMessageId: "user-message-1",
				assistantMessageId: "assistant-message-1",
				content: "Reply",
				usage: {
					promptTokens: 3,
					completionTokens: 5,
				},
			})
		);

		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		await expect(response.text()).resolves.toContain('"type":"done"');
	});

	it("replays stored stream errors with partial content first", async () => {
		const response = buildChatStreamReplayResponse(
			toJsonValue({
				kind: "chat_stream_error",
				error: "Model rate limit reached. Please retry in a moment.",
				errorCode: "PROVIDER_RATE_LIMITED",
				providerStatusCode: 429,
				retryAfterSeconds: 12,
				providerRequestId: "correlation-429",
				partialContent: true,
				content: "Partial",
			})
		);
		const events = parseSseEvents(await response.text());

		expect(events).toEqual([
			{
				type: "content",
				content: "Partial",
			},
			{
				type: "error",
				error: "Model rate limit reached. Please retry in a moment.",
				errorCode: "PROVIDER_RATE_LIMITED",
				providerStatusCode: 429,
				retryAfterSeconds: 12,
				providerRequestId: "correlation-429",
				partialContent: true,
			},
		]);
	});
});
