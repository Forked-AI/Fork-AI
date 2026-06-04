import {
	selectModelProvider,
	getSupportedModelAliases,
} from "@/lib/ai/orchestrator";
import { buildChatStreamReplayResponse } from "@/lib/ai/stream-events";
import { auth } from "@/lib/auth";
import { checkRequestRateLimit } from "@/lib/api-rate-limit";
import {
	checkChatRateLimit,
	type RateLimitResult,
} from "@/lib/chat-rate-limit";
import {
	createChatStreamResponse,
	type ChatRateLimitState,
} from "@/lib/chat/chat-service";
import {
	getForkAiSystemPrompt,
	MissingChatSystemPromptError,
} from "@/lib/chat-system-prompt";
import { RATE_LIMIT_CONSTANTS } from "@/lib/constants";
import {
	beginIdempotency,
	getRequestIdempotencyActorKey,
	getUserIdempotencyActorKey,
	type ActiveIdempotencyRecord,
	type JsonValue,
} from "@/lib/idempotency";
import { logServerError, logServerWarning } from "@/lib/server-safe-log";
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

async function completeResponseIdempotency(
	record: ActiveIdempotencyRecord,
	response: Response
) {
	const body = (await response
		.clone()
		.json()
		.catch(() => ({ error: "Request failed" }))) as JsonValue;
	await record.complete(body, { status: response.status });
	return response;
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

export async function POST(request: Request) {
	let activeIdempotency: ActiveIdempotencyRecord | null = null;

	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});
		const userId = session?.user?.id || null;
		const isGuest = !userId;

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

		const modelSelection = selectModelProvider(model);
		if (!modelSelection) {
			return NextResponse.json(
				{
					error: "Unsupported model",
					supportedModels: getSupportedModelAliases(),
				},
				{ status: 400 }
			);
		}

		const idempotency = await beginIdempotency(request, {
			scope: "chat:stream",
			actorKey: userId
				? getUserIdempotencyActorKey(userId)
				: getRequestIdempotencyActorKey(request, "guest-chat"),
			requestInput: {
				message,
				model: modelSelection.model,
				conversationId,
				parentMessageId,
				history: history ?? [],
				systemPrompt: userCustomInstructions,
			},
			lockSeconds: 10 * 60,
			replayResponse: (record) =>
				buildChatStreamReplayResponse(record.responseBody),
		});
		if (!idempotency.started) {
			return idempotency.response;
		}
		const streamIdempotency = idempotency.record;
		activeIdempotency = streamIdempotency;

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
				return completeResponseIdempotency(
					streamIdempotency,
					minuteRateLimit.response
				);
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
				return completeResponseIdempotency(
					streamIdempotency,
					hourRateLimit.response
				);
			}

			rateLimit = {
				remaining: Math.min(
					minuteRateLimit.state.remaining,
					hourRateLimit.state.remaining
				),
				resetAt:
					minuteRateLimit.state.remaining <=
					hourRateLimit.state.remaining
						? minuteRateLimit.state.resetAt
						: hourRateLimit.state.resetAt,
			};
		} else {
			const rateLimitResult = await checkAuthenticatedChatRateLimits(
				userId!
			);
			if (!rateLimitResult.allowed) {
				return completeResponseIdempotency(
					streamIdempotency,
					rateLimitResult.response
				);
			}
			rateLimit = rateLimitResult.state;
		}

		return createChatStreamResponse({
			userId,
			isGuest,
			message,
			model: modelSelection.model,
			providerName: modelSelection.providerName,
			provider: modelSelection.provider,
			conversationId,
			parentMessageId,
			history,
			appSystemPrompt,
			userCustomInstructions,
			streamIdempotency,
			rateLimit,
		});
	} catch (error) {
		logServerError("chat/stream", "request_error", error);
		if (activeIdempotency) {
			await activeIdempotency.fail(
				{
					error: "Internal server error",
					errorCode: "CHAT_STREAM_REQUEST_FAILED",
				},
				{ status: 500 }
			);
		}
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
