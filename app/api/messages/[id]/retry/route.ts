import {
	getSupportedModelAliases,
	selectModelProvider,
} from "@/lib/ai/orchestrator";
import { buildChatStreamReplayResponse } from "@/lib/ai/stream-events";
import { auth } from "@/lib/auth";
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
	getUserIdempotencyActorKey,
	type ActiveIdempotencyRecord,
	type JsonValue,
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const retryGenerationSchema = z.object({
	model: z.string().optional(),
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

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const suppliedTraceId = request.headers.get("x-request-id")?.trim();
	const traceId =
		suppliedTraceId && suppliedTraceId.length <= 128
			? suppliedTraceId
			: crypto.randomUUID();
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { id } = await params;
		const rawBody = await request.json().catch(() => ({}));
		const parseResult = retryGenerationSchema.safeParse(rawBody);
		if (!parseResult.success) {
			return NextResponse.json(
				{
					error: "Invalid input",
					details: parseResult.error.flatten(),
				},
				{ status: 400 }
			);
		}

		const targetAssistantMessage = await prisma.message.findFirst({
			where: {
				id,
				role: "assistant",
				conversation: {
					userId: session.user.id,
				},
			},
			select: {
				model: true,
			},
		});

		if (!targetAssistantMessage) {
			return NextResponse.json(
				{ error: "Message not found" },
				{ status: 404 }
			);
		}

		const requestedModel =
			parseResult.data.model ??
			targetAssistantMessage.model ??
			"mistral-large-latest";
		const modelSelection = selectModelProvider(requestedModel);
		if (!modelSelection) {
			return NextResponse.json(
				{
					error: "Unsupported model",
					supportedModels: getSupportedModelAliases(),
				},
				{ status: 400 }
			);
		}

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

		const idempotency = await beginIdempotency(request, {
			scope: "messages:retry-generation",
			actorKey: getUserIdempotencyActorKey(session.user.id),
			requestInput: {
				assistantMessageId: id,
				model: modelSelection.model,
				systemPrompt: parseResult.data.systemPrompt ?? "",
			},
			lockSeconds: 10 * 60,
			replayResponse: (record) =>
				buildChatStreamReplayResponse(record.responseBody),
		});
		if (!idempotency.started) {
			return idempotency.response;
		}

		const rateLimit = await checkAuthenticatedChatRateLimits(
			session.user.id
		);
		if (!rateLimit.allowed) {
			return completeResponseIdempotency(
				idempotency.record,
				rateLimit.response
			);
		}

		return createChatStreamResponse({
			userId: session.user.id,
			isGuest: false,
			message: "",
			model: modelSelection.model,
			providerName: modelSelection.providerName,
			provider: modelSelection.provider,
			retryAssistantMessageId: id,
			appSystemPrompt,
			userCustomInstructions: parseResult.data.systemPrompt ?? "",
			modelCapabilities: modelSelection.capabilities,
			streamIdempotency: idempotency.record,
			rateLimit: rateLimit.state,
			traceId,
		});
	} catch (error) {
		logServerError("messages/retry", "retry_failed", error, { traceId });
		return NextResponse.json(
			{ error: "Failed to retry generation" },
			{ status: 500 }
		);
	}
}
