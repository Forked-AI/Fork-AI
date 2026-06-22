import type { JsonValue } from "@/lib/idempotency";
import type { ActiveSkillTrace } from "@/lib/skills/catalog";

export interface ChatStreamUsage {
	promptTokens: number;
	completionTokens: number;
}

export interface ChatStreamCitation {
	index: number;
	chunkId: string;
	fileId: string;
	sourceLabel: string;
	pageNumber: number | null;
	score: number;
}

export interface ChatStreamReplayBody {
	kind: "chat_stream";
	conversationId: string | null;
	userMessageId: string | null;
	assistantMessageId: string | null;
	generationId?: string | null;
	content: string;
	usage: ChatStreamUsage;
	citations?: ChatStreamCitation[];
}

export interface ChatStreamErrorReplayBody {
	kind: "chat_stream_error";
	conversationId?: string | null;
	userMessageId?: string | null;
	assistantMessageId?: string | null;
	generationId?: string | null;
	error: string;
	errorCode: string;
	providerStatusCode?: number;
	retryAfterSeconds?: number;
	providerRequestId?: string;
	partialContent: boolean;
	content: string;
	replacementContent?: string;
}

export type ChatStreamIdempotencyBody =
	| ChatStreamReplayBody
	| ChatStreamErrorReplayBody;

export type ChatStreamEvent =
	| { type: "conversation"; conversationId: string }
	| {
			type: "messageId";
			userMessageId: string;
			assistantMessageId?: string;
			generationId?: string;
			activeSkillTrace?: ActiveSkillTrace | null;
	  }
	| { type: "content"; content: string }
	| { type: "citations"; citations: ChatStreamCitation[] }
	| {
			type: "progress";
			step:
				| "preparing_context"
				| "retrieving_files"
				| "running_tools"
				| "generating_answer"
				| "validating_output";
	  }
	| {
			type: "done";
			assistantMessageId?: string;
			usage: ChatStreamUsage;
	  }
	| {
			type: "error";
			error: string;
			errorCode: string;
			providerStatusCode?: number;
			retryAfterSeconds?: number;
			providerRequestId?: string;
			partialContent: boolean;
			replacementContent?: string;
			traceId?: string;
			generationId?: string | null;
	  };

export function toJsonValue(body: unknown): JsonValue {
	return JSON.parse(JSON.stringify(body)) as JsonValue;
}

export function encodeSseEvent(payload: ChatStreamEvent): string {
	return `data: ${JSON.stringify(payload)}\n\n`;
}

export function enqueueSseEvent(
	controller: ReadableStreamDefaultController<Uint8Array>,
	encoder: TextEncoder,
	payload: ChatStreamEvent
) {
	controller.enqueue(encoder.encode(encodeSseEvent(payload)));
}

export function isChatStreamReplayBody(
	body: unknown
): body is ChatStreamIdempotencyBody {
	return (
		!!body &&
		typeof body === "object" &&
		!Array.isArray(body) &&
		"kind" in body &&
		((body as { kind?: unknown }).kind === "chat_stream" ||
			(body as { kind?: unknown }).kind === "chat_stream_error")
	);
}

export function buildChatStreamReplayResponse(body: JsonValue | null) {
	const encoder = new TextEncoder();
	const streamBody = isChatStreamReplayBody(body)
		? body
		: ({
				kind: "chat_stream_error",
				error: "Stored chat response is unavailable.",
				errorCode: "IDEMPOTENCY_REPLAY_UNAVAILABLE",
				partialContent: false,
				content: "",
			} satisfies ChatStreamErrorReplayBody);

	const stream = new ReadableStream({
		start(controller) {
			if (streamBody.kind === "chat_stream") {
				if (streamBody.conversationId) {
					enqueueSseEvent(controller, encoder, {
						type: "conversation",
						conversationId: streamBody.conversationId,
					});
				}

				if (streamBody.userMessageId) {
					enqueueSseEvent(controller, encoder, {
						type: "messageId",
						userMessageId: streamBody.userMessageId,
						assistantMessageId:
							streamBody.assistantMessageId ?? undefined,
						generationId: streamBody.generationId ?? undefined,
					});
				}

				if (streamBody.content) {
					enqueueSseEvent(controller, encoder, {
						type: "content",
						content: streamBody.content,
					});
				}

				if (streamBody.citations?.length) {
					enqueueSseEvent(controller, encoder, {
						type: "citations",
						citations: streamBody.citations,
					});
				}

				enqueueSseEvent(controller, encoder, {
					type: "done",
					assistantMessageId:
						streamBody.assistantMessageId ?? undefined,
					usage: streamBody.usage,
				});
			} else {
				if (streamBody.conversationId) {
					enqueueSseEvent(controller, encoder, {
						type: "conversation",
						conversationId: streamBody.conversationId,
					});
				}

				if (streamBody.userMessageId) {
					enqueueSseEvent(controller, encoder, {
						type: "messageId",
						userMessageId: streamBody.userMessageId,
						assistantMessageId:
							streamBody.assistantMessageId ?? undefined,
						generationId: streamBody.generationId ?? undefined,
					});
				}

				if (streamBody.content) {
					enqueueSseEvent(controller, encoder, {
						type: "content",
						content: streamBody.content,
					});
				}

				enqueueSseEvent(controller, encoder, {
					type: "error",
					error: streamBody.error,
					errorCode: streamBody.errorCode,
					providerStatusCode: streamBody.providerStatusCode,
					retryAfterSeconds: streamBody.retryAfterSeconds,
					providerRequestId: streamBody.providerRequestId,
					partialContent: streamBody.partialContent,
					replacementContent: streamBody.replacementContent,
				});
			}

			controller.close();
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		},
	});
}
