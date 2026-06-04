import { buildChatProviderMessages } from "@/lib/ai/context-builder";
import { normalizeProviderStreamError } from "@/lib/ai/errors";
import type { ModelProvider } from "@/lib/ai/model-provider";
import {
	enqueueSseEvent,
	type ChatStreamErrorReplayBody,
	type ChatStreamReplayBody,
	toJsonValue,
} from "@/lib/ai/stream-events";
import type { ConversationMessage } from "@/lib/chat-system-prompt";
import {
	buildGuestMessageHistory,
	loadMessageHistory,
	type MessageHistoryPrismaClient,
} from "@/lib/chat/message-history";
import {
	completeGeneration,
	createGenerationAttempt,
	failGeneration,
	flushGenerationContent,
	type GenerationAttempt,
} from "@/lib/chat/generation-service";
import {
	registerGenerationAbortController,
	unregisterGenerationAbortController,
} from "@/lib/chat/generation-abort-registry";
import {
	getModelAccessError,
	isModelIncludedInPlan,
} from "@/lib/model-entitlements";
import { prisma } from "@/lib/prisma";
import {
	logServerError,
	logServerInfo,
	logServerWarning,
} from "@/lib/server-safe-log";
import {
	checkTokenBudgetBeforeRequest,
	type TokenBudgetCheckResult,
} from "@/lib/token-budget";
import type { ActiveIdempotencyRecord, JsonValue } from "@/lib/idempotency";
import { NextResponse } from "next/server";

export interface ChatRateLimitState {
	remaining: number;
	resetAt: Date;
}

interface ChatServicePrismaClient extends MessageHistoryPrismaClient {
	conversation: {
		findFirst(args: {
			where: { id: string; userId: string };
			include: {
				messages: {
					orderBy: { createdAt: "asc" };
					select: { role: true; content: true };
				};
			};
		}): Promise<{ id: string } | null>;
		create(args: {
			data: { title: string; userId: string };
			include: { messages: true };
		}): Promise<{ id: string }>;
		update(args: {
			where: { id: string };
			data: { updatedAt: Date };
		}): Promise<unknown>;
	};
	message: {
		findMany(args: {
			where: { conversationId: string };
			orderBy: { createdAt: "asc" };
			select: { role: true; content: true };
		}): Promise<Array<{ role: string; content: string }>>;
		findFirst(args: any): Promise<any>;
		create(args: any): Promise<{ id: string }>;
		updateMany(args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
	generation: {
		create(args: {
			data: Record<string, unknown>;
			select?: { id: true };
		}): Promise<{ id: string }>;
		updateMany(args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}): Promise<{ count: number }>;
	};
}

export interface CreateChatStreamResponseInput {
	userId: string | null;
	isGuest: boolean;
	message: string;
	model: string;
	providerName: string;
	provider: ModelProvider;
	conversationId?: string | null;
	parentMessageId?: string | null;
	retryAssistantMessageId?: string | null;
	history?: ConversationMessage[];
	appSystemPrompt: string;
	userCustomInstructions: string;
	streamIdempotency: ActiveIdempotencyRecord;
	rateLimit: ChatRateLimitState | null;
	prismaClient?: ChatServicePrismaClient;
}

interface PreparedAuthenticatedChat {
	conversation: { id: string };
	isNewConversation: boolean;
	userMessage: { id: string };
	generationAttempt: GenerationAttempt;
	providerMessages: ReturnType<typeof buildChatProviderMessages>;
	tokenBudgetCheck: TokenBudgetCheckResult;
}

async function completeJsonIdempotency(
	record: ActiveIdempotencyRecord,
	body: unknown,
	status: number
) {
	const jsonBody = JSON.parse(JSON.stringify(body)) as JsonValue;
	await record.complete(jsonBody, { status });
	return NextResponse.json(jsonBody, { status });
}

function buildConversationTitle(message: string): string {
	return message.slice(0, 100) + (message.length > 100 ? "..." : "");
}

async function prepareAuthenticatedChat(
	input: CreateChatStreamResponseInput & { userId: string }
): Promise<PreparedAuthenticatedChat | Response> {
	const prismaClient =
		input.prismaClient ?? (prisma as unknown as ChatServicePrismaClient);
	let conversation: { id: string } | null = null;
	let isNewConversation = false;

	if (input.conversationId) {
		conversation = await prismaClient.conversation.findFirst({
			where: {
				id: input.conversationId,
				userId: input.userId,
			},
			include: {
				messages: {
					orderBy: { createdAt: "asc" },
					select: {
						role: true,
						content: true,
					},
				},
			},
		});

		if (!conversation) {
			return completeJsonIdempotency(
				input.streamIdempotency,
				{ error: "Conversation not found" },
				404
			);
		}
	} else {
		conversation = await prismaClient.conversation.create({
			data: {
				title: buildConversationTitle(input.message),
				userId: input.userId,
			},
			include: {
				messages: true,
			},
		});
		isNewConversation = true;
	}

	const messageHistory = await loadMessageHistory({
		conversationId: conversation.id,
		parentMessageId: input.parentMessageId,
		prismaClient,
	});
	const requestHistory: ConversationMessage[] = [
		...messageHistory,
		{ role: "user", content: input.message },
	];
	const providerMessages = buildChatProviderMessages({
		appSystemPrompt: input.appSystemPrompt,
		userCustomInstructions: input.userCustomInstructions,
		messageHistory: requestHistory,
	});
	const tokenBudgetCheck = await checkTokenBudgetBeforeRequest(
		input.userId,
		providerMessages
	);

	if (!tokenBudgetCheck.allowed) {
		logServerInfo("chat/stream", "token_budget_blocked", {
			planTier: tokenBudgetCheck.tier,
			usageBand: tokenBudgetCheck.usageBand,
			usagePercent: tokenBudgetCheck.usagePercent,
		});
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "You have reached your current plan usage limit.",
				errorCode: "PLAN_USAGE_LIMIT_REACHED",
				plan: {
					tier: tokenBudgetCheck.tier,
					usageBand: tokenBudgetCheck.usageBand,
					usagePercent: tokenBudgetCheck.usagePercent,
					trialEndsAt:
						tokenBudgetCheck.trialEndsAt?.toISOString() ?? null,
				},
			},
			429
		);
	}

	if (!isModelIncludedInPlan(tokenBudgetCheck.tier, input.model)) {
		logServerWarning("chat/stream", "model_entitlement_blocked", {
			planTier: tokenBudgetCheck.tier,
			model: input.model,
		});
		return completeJsonIdempotency(
			input.streamIdempotency,
			getModelAccessError(tokenBudgetCheck.tier, input.model),
			403
		);
	}

	const userMessage = await prismaClient.message.create({
		data: {
			role: "user",
			content: input.message,
			conversationId: conversation.id,
			parentMessageId: input.parentMessageId || null,
		},
	});
	const generationAttempt = await createGenerationAttempt({
		prismaClient,
		userId: input.userId,
		conversationId: conversation.id,
		userMessageId: userMessage.id,
		provider: input.providerName,
		model: input.model,
	});

	return {
		conversation,
		isNewConversation,
		userMessage,
		generationAttempt,
		providerMessages,
		tokenBudgetCheck,
	};
}

async function prepareAuthenticatedRetryChat(
	input: CreateChatStreamResponseInput & {
		userId: string;
		retryAssistantMessageId: string;
	}
): Promise<PreparedAuthenticatedChat | Response> {
	const prismaClient =
		input.prismaClient ?? (prisma as unknown as ChatServicePrismaClient);
	const targetAssistantMessage = await prismaClient.message.findFirst({
		where: {
			id: input.retryAssistantMessageId,
			role: "assistant",
			conversation: {
				userId: input.userId,
			},
		},
		select: {
			id: true,
			model: true,
			parentMessageId: true,
			conversationId: true,
		},
	});

	if (!targetAssistantMessage) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{ error: "Message not found" },
			404
		);
	}

	if (!targetAssistantMessage.parentMessageId) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "Assistant message cannot be retried because it has no user prompt.",
				errorCode: "RETRY_PARENT_MESSAGE_MISSING",
			},
			400
		);
	}

	const userMessage = await prismaClient.message.findFirst({
		where: {
			id: targetAssistantMessage.parentMessageId,
			conversationId: targetAssistantMessage.conversationId,
			role: "user",
		},
		select: {
			id: true,
			content: true,
			parentMessageId: true,
		},
	});

	if (!userMessage) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "Original user message not found",
				errorCode: "RETRY_PARENT_MESSAGE_NOT_FOUND",
			},
			404
		);
	}

	const messageHistory = userMessage.parentMessageId
		? await loadMessageHistory({
				conversationId: targetAssistantMessage.conversationId,
				parentMessageId: userMessage.parentMessageId,
				prismaClient,
			})
		: [];
	const requestHistory: ConversationMessage[] = [
		...messageHistory,
		{ role: "user", content: userMessage.content },
	];
	const providerMessages = buildChatProviderMessages({
		appSystemPrompt: input.appSystemPrompt,
		userCustomInstructions: input.userCustomInstructions,
		messageHistory: requestHistory,
	});
	const tokenBudgetCheck = await checkTokenBudgetBeforeRequest(
		input.userId,
		providerMessages
	);

	if (!tokenBudgetCheck.allowed) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			{
				error: "You have reached your current plan usage limit.",
				errorCode: "PLAN_USAGE_LIMIT_REACHED",
				plan: {
					tier: tokenBudgetCheck.tier,
					usageBand: tokenBudgetCheck.usageBand,
					usagePercent: tokenBudgetCheck.usagePercent,
					trialEndsAt:
						tokenBudgetCheck.trialEndsAt?.toISOString() ?? null,
				},
			},
			429
		);
	}

	if (!isModelIncludedInPlan(tokenBudgetCheck.tier, input.model)) {
		return completeJsonIdempotency(
			input.streamIdempotency,
			getModelAccessError(tokenBudgetCheck.tier, input.model),
			403
		);
	}

	const generationAttempt = await createGenerationAttempt({
		prismaClient,
		userId: input.userId,
		conversationId: targetAssistantMessage.conversationId,
		userMessageId: userMessage.id,
		provider: input.providerName,
		model: input.model,
	});

	return {
		conversation: { id: targetAssistantMessage.conversationId },
		isNewConversation: false,
		userMessage: { id: userMessage.id },
		generationAttempt,
		providerMessages,
		tokenBudgetCheck,
	};
}

async function prepareGuestChat(
	input: CreateChatStreamResponseInput
): Promise<
	| { providerMessages: ReturnType<typeof buildChatProviderMessages> }
	| Response
> {
	if (!isModelIncludedInPlan("guest", input.model)) {
		logServerWarning("chat/stream", "model_entitlement_blocked", {
			planTier: "guest",
			model: input.model,
		});
		return completeJsonIdempotency(
			input.streamIdempotency,
			getModelAccessError("guest", input.model),
			403
		);
	}

	const messageHistory = buildGuestMessageHistory(
		input.history,
		input.message
	);

	return {
		providerMessages: buildChatProviderMessages({
			appSystemPrompt: input.appSystemPrompt,
			userCustomInstructions: input.userCustomInstructions,
			messageHistory,
		}),
	};
}

function buildStreamHeaders(
	tokenBudgetCheck: TokenBudgetCheckResult | null,
	rateLimit: ChatRateLimitState | null
) {
	return {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Plan-Tier": tokenBudgetCheck?.tier ?? "guest",
		"X-Plan-Usage": tokenBudgetCheck?.usageBand ?? "unknown",
		"X-RateLimit-Remaining": String(rateLimit?.remaining || 0),
		"X-RateLimit-Reset":
			rateLimit?.resetAt?.toISOString() || new Date().toISOString(),
	};
}

export async function createChatStreamResponse(
	input: CreateChatStreamResponseInput
): Promise<Response> {
	const prismaClient =
		input.prismaClient ?? (prisma as unknown as ChatServicePrismaClient);
	let conversation: { id: string } | null = null;
	let isNewConversation = false;
	let userMessage: { id: string } | null = null;
	let generationAttempt: GenerationAttempt | null = null;
	let tokenBudgetCheck: TokenBudgetCheckResult | null = null;
	let providerMessages: ReturnType<typeof buildChatProviderMessages>;

	if (!input.isGuest) {
		if (!input.userId) {
			return completeJsonIdempotency(
				input.streamIdempotency,
				{ error: "Internal server error" },
				500
			);
		}

		const prepared = input.retryAssistantMessageId
			? await prepareAuthenticatedRetryChat({
					...input,
					userId: input.userId,
					retryAssistantMessageId: input.retryAssistantMessageId,
					prismaClient,
				})
			: await prepareAuthenticatedChat({
					...input,
					userId: input.userId,
					prismaClient,
				});

		if (prepared instanceof Response) {
			return prepared;
		}

		conversation = prepared.conversation;
		isNewConversation = prepared.isNewConversation;
		userMessage = prepared.userMessage;
		generationAttempt = prepared.generationAttempt;
		providerMessages = prepared.providerMessages;
		tokenBudgetCheck = prepared.tokenBudgetCheck;
	} else {
		const prepared = await prepareGuestChat(input);

		if (prepared instanceof Response) {
			return prepared;
		}

		providerMessages = prepared.providerMessages;
	}

	const encoder = new TextEncoder();
	let fullResponse = "";
	let promptTokens = 0;
	let completionTokens = 0;
	let lastFlushAt = 0;
	let lastFlushLength = 0;

	const readableStream = new ReadableStream({
		async start(controller) {
			const abortController =
				!input.isGuest && generationAttempt
					? new AbortController()
					: null;

			try {
				if (!input.isGuest && isNewConversation && conversation) {
					enqueueSseEvent(controller, encoder, {
						type: "conversation",
						conversationId: conversation.id,
					});
				}

				if (!input.isGuest && userMessage) {
					enqueueSseEvent(controller, encoder, {
						type: "messageId",
						userMessageId: userMessage.id,
						assistantMessageId:
							generationAttempt?.assistantMessage.id,
						generationId: generationAttempt?.generation.id,
					});
				}

				if (abortController && generationAttempt) {
					registerGenerationAbortController(
						generationAttempt.generation.id,
						abortController
					);
				}

				const stream = await input.provider.stream({
					model: input.model,
					messages: providerMessages,
					signal: abortController?.signal,
				});

				for await (const chunk of stream) {
					if (chunk.content) {
						fullResponse += chunk.content;
						enqueueSseEvent(controller, encoder, {
							type: "content",
							content: chunk.content,
						});

						if (
							!input.isGuest &&
							generationAttempt &&
							(Date.now() - lastFlushAt >= 1000 ||
								fullResponse.length - lastFlushLength >= 1000)
						) {
							await flushGenerationContent({
								prismaClient,
								assistantMessageId:
									generationAttempt.assistantMessage.id,
								generationId: generationAttempt.generation.id,
								content: fullResponse,
							});
							lastFlushAt = Date.now();
							lastFlushLength = fullResponse.length;
						}
					}

					if (chunk.usage) {
						promptTokens = chunk.usage.promptTokens || 0;
						completionTokens = chunk.usage.completionTokens || 0;
					}
				}

				if (
					!input.isGuest &&
					conversation &&
					userMessage &&
					generationAttempt
				) {
					const completed = await completeGeneration({
						prismaClient,
						assistantMessageId:
							generationAttempt.assistantMessage.id,
						generationId: generationAttempt.generation.id,
						content: fullResponse,
						promptTokens,
						completionTokens,
					});

					await prismaClient.conversation.update({
						where: { id: conversation.id },
						data: { updatedAt: new Date() },
					});

					if (!completed) {
						await input.streamIdempotency.fail(
							toJsonValue({
								kind: "chat_stream_error",
								conversationId: conversation.id,
								userMessageId: userMessage.id,
								assistantMessageId:
									generationAttempt.assistantMessage.id,
								generationId:
									generationAttempt.generation.id,
								error: "Generation cancelled.",
								errorCode: "GENERATION_CANCELLED",
								partialContent: fullResponse.length > 0,
								content: fullResponse,
							} satisfies ChatStreamErrorReplayBody),
							{
								status: 200,
								resourceType: "message",
								resourceId:
									generationAttempt.assistantMessage.id,
							}
						);
						return;
					}

					await input.streamIdempotency.complete(
						toJsonValue({
							kind: "chat_stream",
							conversationId: conversation.id,
							userMessageId: userMessage.id,
							assistantMessageId:
								generationAttempt.assistantMessage.id,
							generationId: generationAttempt.generation.id,
							content: fullResponse,
							usage: {
								promptTokens,
								completionTokens,
							},
						} satisfies ChatStreamReplayBody),
						{
							status: 200,
							resourceType: "message",
							resourceId:
								generationAttempt.assistantMessage.id,
						}
					);

					enqueueSseEvent(controller, encoder, {
						type: "done",
						assistantMessageId:
							generationAttempt.assistantMessage.id,
						usage: { promptTokens, completionTokens },
					});
				} else {
					await input.streamIdempotency.complete(
						toJsonValue({
							kind: "chat_stream",
							conversationId: null,
							userMessageId: null,
							assistantMessageId: null,
							content: fullResponse,
							usage: {
								promptTokens,
								completionTokens,
							},
						} satisfies ChatStreamReplayBody),
						{ status: 200 }
					);

					enqueueSseEvent(controller, encoder, {
						type: "done",
						usage: { promptTokens, completionTokens },
					});
				}
			} catch (error) {
				logServerError("chat/stream", "stream_error", error, {
					isGuest: input.isGuest,
					model: input.model,
				});

				const streamError = normalizeProviderStreamError(error);
				if (!input.isGuest && generationAttempt) {
					await failGeneration({
						prismaClient,
						assistantMessageId:
							generationAttempt.assistantMessage.id,
						generationId: generationAttempt.generation.id,
						content: fullResponse,
						error: streamError,
					});
				}
				await input.streamIdempotency.fail(
					toJsonValue({
						kind: "chat_stream_error",
						conversationId: conversation?.id ?? null,
						userMessageId: userMessage?.id ?? null,
						assistantMessageId:
							generationAttempt?.assistantMessage.id ?? null,
						generationId:
							generationAttempt?.generation.id ?? null,
						error: streamError.message,
						errorCode: streamError.errorCode,
						providerStatusCode: streamError.providerStatusCode,
						retryAfterSeconds: streamError.retryAfterSeconds,
						providerRequestId: streamError.providerRequestId,
						partialContent: fullResponse.length > 0,
						content: fullResponse,
					} satisfies ChatStreamErrorReplayBody),
					{ status: 200 }
				);
				enqueueSseEvent(controller, encoder, {
					type: "error",
					error: streamError.message,
					errorCode: streamError.errorCode,
					providerStatusCode: streamError.providerStatusCode,
					retryAfterSeconds: streamError.retryAfterSeconds,
					providerRequestId: streamError.providerRequestId,
					partialContent: fullResponse.length > 0,
				});
			} finally {
				if (generationAttempt) {
					unregisterGenerationAbortController(
						generationAttempt.generation.id
					);
				}
				controller.close();
			}
		},
	});

	return new Response(readableStream, {
		headers: buildStreamHeaders(tokenBudgetCheck, input.rateLimit),
	});
}
