import { auth } from "@/lib/auth";
import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import {
	checkChatRateLimit,
	type RateLimitResult,
} from "@/lib/chat-rate-limit";
import {
	buildProviderMessages,
	type ConversationMessage,
	getForkAiSystemPrompt,
	MissingChatSystemPromptError,
	type ProviderMessage,
	toConversationMessages,
} from "@/lib/chat-system-prompt";
import { RATE_LIMIT_CONSTANTS } from "@/lib/constants";
import {
	getModelAccessError,
	isModelIncludedInPlan,
} from "@/lib/model-entitlements";
import { mistralClient } from "@/lib/models";
import { prisma } from "@/lib/prisma";
import {
	logServerError,
	logServerInfo,
	logServerWarning,
} from "@/lib/server-safe-log";
import { checkTokenBudgetBeforeRequest } from "@/lib/token-budget";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_CLIENT_HISTORY_MESSAGES = 100;

const clientHistoryEntrySchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z
		.string()
		.min(1, "History message cannot be empty")
		.max(32000, "History message too long"),
});

// Input validation schema
const sendMessageSchema = z.object({
	message: z
		.string()
		.min(1, "Message cannot be empty")
		.max(32000, "Message too long"),
	model: z.string().default("mistral-large-latest"),
	conversationId: z.string().optional().nullable(),
	parentMessageId: z.string().optional().nullable(),
	history: z
		.array(clientHistoryEntrySchema)
		.max(
			MAX_CLIENT_HISTORY_MESSAGES,
			`History cannot exceed ${MAX_CLIENT_HISTORY_MESSAGES} messages`
		)
		.optional(),
	systemPrompt: z
		.string()
		.trim()
		.max(500, "System prompt too long")
		.optional(),
});

// Supported models mapping
const SUPPORTED_MODELS: Record<string, string> = {
	"mistral-large": "mistral-large-latest",
	"mistral-large-latest": "mistral-large-latest",
	"mistral-small": "mistral-small-latest",
	"mistral-small-latest": "mistral-small-latest",
	codestral: "codestral-latest",
	"codestral-latest": "codestral-latest",
	"ministral-8b": "ministral-8b-latest",
	"ministral-8b-latest": "ministral-8b-latest",
	"ministral-3b": "ministral-3b-latest",
	"ministral-3b-latest": "ministral-3b-latest",
	"pixtral-large": "pixtral-large-latest",
	"pixtral-large-latest": "pixtral-large-latest",
	"open-mistral-nemo": "open-mistral-nemo",
};

interface NormalizedStreamError {
	message: string;
	errorCode: string;
	providerStatusCode?: number;
	retryAfterSeconds?: number;
	providerRequestId?: string;
}

interface ChatRateLimitState {
	remaining: number;
	resetAt: Date;
}

function getRetryAfterSeconds(rateLimit: RateLimitResult): number {
	if (rateLimit.retryAfterSeconds !== undefined) {
		return rateLimit.retryAfterSeconds;
	}

	return Math.max(
		1,
		Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
	);
}

function buildChatRateLimitResponse(rateLimit: RateLimitResult) {
	const retryAfterSeconds = getRetryAfterSeconds(rateLimit);

	return NextResponse.json(
		{
			error: "Rate limit exceeded",
			errorCode: "CHAT_RATE_LIMIT_EXCEEDED",
			retryAfterSeconds,
			retryAfter: retryAfterSeconds,
			resetAt: rateLimit.resetAt.toISOString(),
		},
		{
			status: 429,
			headers: {
				"Retry-After": String(retryAfterSeconds),
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
			},
		}
	);
}

async function checkAuthenticatedChatRateLimits(
	userId: string
): Promise<
	| { allowed: true; state: ChatRateLimitState }
	| { allowed: false; response: NextResponse }
> {
	const minuteRateLimit = await checkChatRateLimit(userId, {
		maxRequests: RATE_LIMIT_CONSTANTS.MAX_MESSAGES_PER_MINUTE,
		windowSeconds: RATE_LIMIT_CONSTANTS.CHAT_MINUTE_WINDOW_SECONDS,
		bucket: "chat-minute",
	});

	if (!minuteRateLimit.allowed) {
		return {
			allowed: false,
			response: buildChatRateLimitResponse(minuteRateLimit),
		};
	}

	const hourRateLimit = await checkChatRateLimit(userId, {
		maxRequests: RATE_LIMIT_CONSTANTS.MAX_MESSAGES_PER_HOUR,
		windowSeconds: RATE_LIMIT_CONSTANTS.CHAT_HOUR_WINDOW_SECONDS,
		bucket: "chat-hour",
	});

	if (!hourRateLimit.allowed) {
		return {
			allowed: false,
			response: buildChatRateLimitResponse(hourRateLimit),
		};
	}

	return {
		allowed: true,
		state: {
			remaining: Math.min(
				minuteRateLimit.remaining,
				hourRateLimit.remaining
			),
			resetAt:
				minuteRateLimit.remaining <= hourRateLimit.remaining
					? minuteRateLimit.resetAt
					: hourRateLimit.resetAt,
		},
	};
}

function getHeaderValue(headers: unknown, headerName: string): string | null {
	if (!headers) {
		return null;
	}

	if (headers instanceof Headers) {
		return headers.get(headerName);
	}

	if (typeof headers !== "object") {
		return null;
	}

	const lowerHeaderName = headerName.toLowerCase();
	for (const [key, value] of Object.entries(
		headers as Record<string, unknown>
	)) {
		if (key.toLowerCase() !== lowerHeaderName) {
			continue;
		}

		if (typeof value === "string") {
			return value;
		}

		if (Array.isArray(value) && value.length > 0) {
			return String(value[0]);
		}

		if (value != null) {
			return String(value);
		}
	}

	return null;
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
	if (!value) {
		return undefined;
	}

	const asNumber = Number(value);
	if (Number.isFinite(asNumber) && asNumber >= 0) {
		return Math.ceil(asNumber);
	}

	const asDateMs = Date.parse(value);
	if (Number.isNaN(asDateMs)) {
		return undefined;
	}

	return Math.max(0, Math.ceil((asDateMs - Date.now()) / 1000));
}

function normalizeStreamError(error: unknown): NormalizedStreamError {
	const providerError = error as {
		statusCode?: number;
		status?: number;
		headers?: unknown;
		rawResponse?: {
			status?: number;
			headers?: unknown;
		};
	};

	const providerStatusCode =
		providerError.statusCode ??
		providerError.status ??
		providerError.rawResponse?.status;
	const providerHeaders =
		providerError.headers ?? providerError.rawResponse?.headers;
	const retryAfterSeconds =
		parseRetryAfterSeconds(
			getHeaderValue(providerHeaders, "retry-after")
		) ??
		parseRetryAfterSeconds(
			getHeaderValue(providerHeaders, "x-ratelimit-reset")
		);
	const providerRequestId =
		getHeaderValue(providerHeaders, "mistral-correlation-id") ??
		getHeaderValue(providerHeaders, "x-kong-request-id") ??
		undefined;

	if (providerStatusCode === 429) {
		return {
			message: "Model rate limit reached. Please retry in a moment.",
			errorCode: "PROVIDER_RATE_LIMITED",
			providerStatusCode,
			retryAfterSeconds,
			providerRequestId,
		};
	}

	return {
		message: "Stream interrupted. You can retry this message.",
		errorCode: "STREAM_INTERRUPTED",
		providerStatusCode,
		providerRequestId,
	};
}

export async function POST(request: Request) {
	try {
		// 1. Authenticate user (optional for guest mode)
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		const userId = session?.user?.id || null;
		const isGuest = !userId;

		// 2. Parse and validate input
		const body = await request.json();
		const parseResult = sendMessageSchema.safeParse(body);

		if (!parseResult.success) {
			logServerWarning("chat/stream", "validation_failed", {
				issues: parseResult.error.issues.length,
			});
			return NextResponse.json(
				{
					error: "Invalid input",
					details: parseResult.error.flatten(),
				},
				{ status: 400 }
			);
		}

		const { message, model, conversationId, parentMessageId, history } =
			parseResult.data;
		const userCustomInstructions = parseResult.data.systemPrompt || "";
		let appSystemPrompt: string;

		try {
			appSystemPrompt = getForkAiSystemPrompt();
		} catch (error) {
			if (error instanceof MissingChatSystemPromptError) {
				return NextResponse.json(
					{
						error: "Chat system prompt is not configured",
						errorCode: "CHAT_SYSTEM_PROMPT_MISSING",
					},
					{ status: 500 }
				);
			}

			throw error;
		}

		// 3. Validate model
		const mistralModel = SUPPORTED_MODELS[model];
		if (!mistralModel) {
			return NextResponse.json(
				{
					error: "Unsupported model",
					supportedModels: Object.keys(SUPPORTED_MODELS),
				},
				{ status: 400 }
			);
		}

		// 4. Check rate limits
		let rateLimit: ChatRateLimitState | null = null;
		if (isGuest) {
			const minuteRateLimit = await checkRequestRateLimit(request, {
				bucket: "chat-guest-minute",
				maxRequests: RATE_LIMIT_CONSTANTS.MAX_GUEST_MESSAGES_PER_MINUTE,
				windowSeconds: RATE_LIMIT_CONSTANTS.CHAT_MINUTE_WINDOW_SECONDS,
				error: "Rate limit exceeded",
				errorCode: "CHAT_RATE_LIMIT_EXCEEDED",
				scope: "chat/stream",
			});
			if (!minuteRateLimit.allowed) {
				return minuteRateLimit.response;
			}

			const hourRateLimit = await checkRequestRateLimit(request, {
				bucket: "chat-guest-hour",
				maxRequests: RATE_LIMIT_CONSTANTS.MAX_GUEST_MESSAGES_PER_HOUR,
				windowSeconds: RATE_LIMIT_CONSTANTS.CHAT_HOUR_WINDOW_SECONDS,
				error: "Rate limit exceeded",
				errorCode: "CHAT_RATE_LIMIT_EXCEEDED",
				scope: "chat/stream",
			});
			if (!hourRateLimit.allowed) {
				return hourRateLimit.response;
			}

			rateLimit = {
				remaining: Math.min(
					minuteRateLimit.state.remaining,
					hourRateLimit.state.remaining
				),
				resetAt:
					minuteRateLimit.state.remaining <= hourRateLimit.state.remaining
						? minuteRateLimit.state.resetAt
						: hourRateLimit.state.resetAt,
			};
		} else {
			const rateLimitResult = await checkAuthenticatedChatRateLimits(
				userId!
			);
			if (!rateLimitResult.allowed) {
				return rateLimitResult.response;
			}
			rateLimit = rateLimitResult.state;
		}

		// 5. Get or create conversation (skip for guests)
		let conversation: any = null;
		let isNewConversation = false;
		let userMessage: any = null;
		let messageHistory: ConversationMessage[] = [];
		let providerMessages: ProviderMessage[] = [];
		let tokenBudgetCheck: Awaited<
			ReturnType<typeof checkTokenBudgetBeforeRequest>
		> | null = null;

		const buildMessageHistory = async (
			conversationIdToUse: string,
			branchParentId?: string | null
		): Promise<ConversationMessage[]> => {
			// Normal linear path: full ordered history
			if (!branchParentId) {
				const linearMessages = await prisma.message.findMany({
					where: { conversationId: conversationIdToUse },
					orderBy: { createdAt: "asc" },
					select: { role: true, content: true },
				});

				return toConversationMessages(linearMessages);
			}

			// Branch path: walk ancestors from selected parent back to root
			const ancestorPath: Array<{
				role: string;
				content: string;
			}> = [];
			let currentId: string | null = branchParentId;

			while (currentId) {
				const messageNode: {
					role: string;
					content: string;
					parentMessageId: string | null;
				} | null = await prisma.message.findFirst({
					where: {
						id: currentId,
						conversationId: conversationIdToUse,
					},
					select: {
						role: true,
						content: true,
						parentMessageId: true,
					},
				});

				if (!messageNode) break;

				ancestorPath.unshift({
					role: messageNode.role,
					content: messageNode.content,
				});

				currentId = messageNode.parentMessageId ?? null;
			}

			return toConversationMessages(ancestorPath);
		};

		if (!isGuest) {
			if (conversationId) {
				// Verify ownership
				conversation = await prisma.conversation.findFirst({
					where: {
						id: conversationId,
						userId: userId!,
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
					return NextResponse.json(
						{ error: "Conversation not found" },
						{ status: 404 }
					);
				}
			} else {
				// Create new conversation with first message as title
				const title =
					message.slice(0, 100) + (message.length > 100 ? "..." : "");
				conversation = await prisma.conversation.create({
					data: {
						title,
						userId: userId!,
					},
					include: {
						messages: true,
					},
				});
				isNewConversation = true;
			}

			// 6. Build message history for Mistral
			messageHistory = await buildMessageHistory(
				conversation.id,
				parentMessageId
			);

			const requestHistory: ConversationMessage[] = [
				...messageHistory,
				{ role: "user", content: message },
			];
			const requestProviderMessages = buildProviderMessages(
				appSystemPrompt,
				userCustomInstructions,
				requestHistory
			);

			tokenBudgetCheck = await checkTokenBudgetBeforeRequest(
				userId!,
				requestProviderMessages
			);

			if (!tokenBudgetCheck.allowed) {
				logServerInfo("chat/stream", "token_budget_blocked", {
					planTier: tokenBudgetCheck.tier,
					usageBand: tokenBudgetCheck.usageBand,
					usagePercent: tokenBudgetCheck.usagePercent,
				});
				return NextResponse.json(
					{
						error: "You have reached your current plan usage limit.",
						errorCode: "PLAN_USAGE_LIMIT_REACHED",
						plan: {
							tier: tokenBudgetCheck.tier,
							usageBand: tokenBudgetCheck.usageBand,
							usagePercent: tokenBudgetCheck.usagePercent,
							trialEndsAt:
								tokenBudgetCheck.trialEndsAt?.toISOString() ??
								null,
						},
					},
					{ status: 429 }
				);
			}

			if (!isModelIncludedInPlan(tokenBudgetCheck.tier, mistralModel)) {
				logServerWarning("chat/stream", "model_entitlement_blocked", {
					planTier: tokenBudgetCheck.tier,
					model: mistralModel,
				});
				return NextResponse.json(
					getModelAccessError(tokenBudgetCheck.tier, mistralModel),
					{ status: 403 }
				);
			}

			// 7. Save user message to database
			userMessage = await prisma.message.create({
				data: {
					role: "user",
					content: message,
					conversationId: conversation.id,
					parentMessageId: parentMessageId || null,
				},
			});

			// 8. Append current prompt as newest user turn
			messageHistory = requestHistory;
			providerMessages = requestProviderMessages;
		} else {
			if (!isModelIncludedInPlan("guest", mistralModel)) {
				logServerWarning("chat/stream", "model_entitlement_blocked", {
					planTier: "guest",
					model: mistralModel,
				});
				return NextResponse.json(
					getModelAccessError("guest", mistralModel),
					{ status: 403 }
				);
			}

			// For guest users, reuse the current in-memory path when provided.
			messageHistory = [
				...(history ?? []),
				{ role: "user", content: message },
			];
			providerMessages = buildProviderMessages(
				appSystemPrompt,
				userCustomInstructions,
				messageHistory
			);
		}

		// 8. Create streaming response
		const encoder = new TextEncoder();
		let fullResponse = "";
		let promptTokens = 0;
		let completionTokens = 0;

		const readableStream = new ReadableStream({
			async start(controller) {
				try {
					const stream = await mistralClient.chat.stream({
						model: mistralModel,
						messages: providerMessages,
					});

					if (!isGuest && isNewConversation && conversation) {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: "conversation",
									conversationId: conversation.id,
								})}\n\n`
							)
						);
					}

					if (!isGuest && userMessage) {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: "messageId",
									userMessageId: userMessage.id,
								})}\n\n`
							)
						);
					}

					for await (const event of stream) {
						const content = event.data?.choices[0]?.delta.content;
						if (content) {
							fullResponse += content;
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({ type: "content", content })}\n\n`
								)
							);
						}

						if (event.data?.usage) {
							promptTokens = event.data.usage.promptTokens || 0;
							completionTokens =
								event.data.usage.completionTokens || 0;
						}
					}

					if (!isGuest && conversation) {
						const assistantMessage = await prisma.message.create({
							data: {
								role: "assistant",
								content: fullResponse,
								model: mistralModel,
								promptTokens,
								completionTokens,
								conversationId: conversation.id,
								parentMessageId: userMessage.id,
								isError: false,
							},
						});

						await prisma.conversation.update({
							where: { id: conversation.id },
							data: { updatedAt: new Date() },
						});

						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: "done",
									assistantMessageId: assistantMessage.id,
									usage: { promptTokens, completionTokens },
								})}\n\n`
							)
						);
					} else {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: "done",
									usage: { promptTokens, completionTokens },
								})}\n\n`
							)
						);
					}
				} catch (error) {
					logServerError("chat/stream", "stream_error", error, {
						isGuest,
						model: mistralModel,
					});

					if (!isGuest && conversation) {
						await prisma.message.create({
							data: {
								role: "assistant",
								content: fullResponse,
								model: mistralModel,
								conversationId: conversation.id,
								parentMessageId: userMessage?.id ?? null,
								isError: true,
							},
						});
					}

					const streamError = normalizeStreamError(error);
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({
								type: "error",
								error: streamError.message,
								errorCode: streamError.errorCode,
								providerStatusCode:
									streamError.providerStatusCode,
								retryAfterSeconds:
									streamError.retryAfterSeconds,
								providerRequestId:
									streamError.providerRequestId,
								partialContent: fullResponse.length > 0,
							})}\n\n`
						)
					);
				} finally {
					controller.close();
				}
			},
		});

		return new Response(readableStream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Plan-Tier": tokenBudgetCheck?.tier ?? "guest",
				"X-Plan-Usage": tokenBudgetCheck?.usageBand ?? "unknown",
				"X-RateLimit-Remaining": String(
					rateLimit?.remaining || 0
				),
				"X-RateLimit-Reset": isGuest
					? rateLimit?.resetAt?.toISOString() ||
						new Date().toISOString()
					: rateLimit?.resetAt?.toISOString() ||
						new Date().toISOString(),
			},
		});
	} catch (error) {
		logServerError("chat/stream", "request_error", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
