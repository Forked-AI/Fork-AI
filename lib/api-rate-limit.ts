import {
	checkChatRateLimit,
	type RateLimitConfig,
	type RateLimitResult,
} from "@/lib/chat-rate-limit";
import { recordOperationalMetric } from "@/lib/operational-metrics";
import { getRequestIdentity, hashIdentity } from "@/lib/request-identity";
import { logServerWarning } from "@/lib/server-safe-log";
import { NextResponse } from "next/server";

export interface ApiRateLimitOptions {
	bucket: string;
	maxRequests: number;
	windowSeconds: number;
	identityParts?: Array<string | number | null | undefined>;
	error?: string;
	errorCode?: string;
	scope?: string;
}

export interface ApiRateLimitAllowed {
	allowed: true;
	state: RateLimitResult;
	identityHash: string;
}

export interface ApiRateLimitBlocked {
	allowed: false;
	response: NextResponse;
	state: RateLimitResult;
	identityHash: string;
}

export type ApiRateLimitCheck = ApiRateLimitAllowed | ApiRateLimitBlocked;

export function getRetryAfterSeconds(rateLimit: RateLimitResult): number {
	if (rateLimit.retryAfterSeconds !== undefined) {
		return rateLimit.retryAfterSeconds;
	}

	return Math.max(
		1,
		Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
	);
}

export function buildRateLimitResponse(
	rateLimit: RateLimitResult,
	options: Pick<ApiRateLimitOptions, "error" | "errorCode"> = {}
) {
	const retryAfterSeconds = getRetryAfterSeconds(rateLimit);

	return NextResponse.json(
		{
			error: options.error ?? "Rate limit exceeded",
			errorCode: options.errorCode ?? "RATE_LIMIT_EXCEEDED",
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

export async function checkRequestRateLimit(
	request: Request,
	options: ApiRateLimitOptions
): Promise<ApiRateLimitCheck> {
	const identityHash = getRequestIdentity(
		request,
		options.bucket,
		...(options.identityParts ?? [])
	);
	const config: RateLimitConfig = {
		maxRequests: options.maxRequests,
		windowSeconds: options.windowSeconds,
		bucket: options.bucket,
	};
	const state = await checkChatRateLimit(identityHash, config);

	if (state.allowed) {
		return { allowed: true, state, identityHash };
	}

	logServerWarning(options.scope ?? "api/rate-limit", "rate_limited", {
		bucket: options.bucket,
		actorHash: hashIdentity(identityHash),
		retryAfterSeconds: getRetryAfterSeconds(state),
	});
	await recordOperationalMetric({
		kind: "rate_limit",
		source: options.bucket,
		status: "blocked",
		route: options.scope ?? null,
		errorCode: options.errorCode ?? "RATE_LIMIT_EXCEEDED",
		traceId: hashIdentity(identityHash),
		metadata: {
			bucket: options.bucket,
			actorHash: hashIdentity(identityHash),
			retryAfterSeconds: getRetryAfterSeconds(state),
			windowSeconds: options.windowSeconds,
			maxRequests: options.maxRequests,
		},
	});

	return {
		allowed: false,
		response: buildRateLimitResponse(state, options),
		state,
		identityHash,
	};
}
