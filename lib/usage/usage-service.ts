import type { ModelUsage } from "@/lib/ai/model-provider";
import { createTokenEstimator } from "@/lib/ai/token-estimator";
import type { ProviderMessage } from "@/lib/chat-system-prompt";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-safe-log";
import { getUtcMonthWindow } from "@/lib/subscription";
import { estimateUsageCost } from "@/lib/usage/pricing";

export type UsageFeature =
	| "chat_response"
	| "conversation_summary"
	| "conversation_title";
export type UsageOutcome =
	| "pending"
	| "completed"
	| "failed"
	| "cancelled"
	| "moderated";
export type UsageSource = "provider" | "estimate" | "none" | "legacy_unknown";

type UsagePrismaClient = any;

const DEFAULT_STALE_USAGE_TIMEOUT_MS = 15 * 60 * 1000;

async function recordUsageOperationalMetric({
	prismaClient,
	event,
	outcome,
	measurement,
	errorCode,
	providerStatusCode,
	finalizedAt,
}: {
	prismaClient: UsagePrismaClient;
	event: {
		id: string;
		userId: string | null;
		conversationId: string | null;
		feature: UsageFeature;
		provider: string;
		requestedModel: string;
		startedAt: Date;
	};
	outcome: Exclude<UsageOutcome, "pending">;
	measurement: UsageMeasurement;
	errorCode?: string | null;
	providerStatusCode?: number | null;
	finalizedAt: Date;
}) {
	if (!prismaClient.operationalMetric?.create) return;

	try {
		await prismaClient.operationalMetric.create({
			data: {
				kind: "ai_provider",
				source: event.feature,
				status: outcome === "completed" ? "success" : outcome,
				provider: event.provider,
				model: measurement.resolvedModel ?? event.requestedModel,
				durationMs: Math.max(
					0,
					finalizedAt.getTime() - event.startedAt.getTime()
				),
				totalTokens: measurement.billableUnits,
				costTotal: measurement.estimatedCostUsd
					? Number(measurement.estimatedCostUsd)
					: null,
				errorCode: errorCode ?? null,
				providerStatus: providerStatusCode ?? null,
				userId: event.userId,
				conversationId: event.conversationId,
				traceId: event.id,
				metadataJson: {
					usageSource: measurement.usageSource,
					pricingVersion: measurement.pricingVersion,
					costIsEstimate: measurement.costIsEstimate,
				},
			},
		});
	} catch (error) {
		logServerError("usage/metrics", "record_failed", error, {
			usageEventId: event.id,
			feature: event.feature,
		});
	}
}

export interface CreateUsageAttemptInput {
	prismaClient?: UsagePrismaClient;
	deduplicationKey: string;
	userId?: string | null;
	organizationId?: string | null;
	conversationId?: string | null;
	messageId?: string | null;
	generationId?: string | null;
	feature: UsageFeature;
	provider: string;
	requestedModel: string;
	promptVersion?: string | null;
	startedAt?: Date;
}

export interface UsageMeasurement {
	inputTokens: number;
	outputTokens: number;
	billableUnits: number;
	usageSource: UsageSource;
	resolvedModel: string | null;
	providerRequestId: string | null;
	estimatedCostUsd: string | null;
	costIsEstimate: boolean;
	pricingVersion: string | null;
}

export interface BuildUsageMeasurementInput {
	requestedModel: string;
	resolvedModel?: string | null;
	providerRequestId?: string | null;
	providerUsage?: ModelUsage | null;
	estimatedInputTokens?: number | null;
	estimatedOutputTokens?: number | null;
	outcome: Exclude<UsageOutcome, "pending">;
	hasPartialOutput?: boolean;
	usageSourceOverride?: UsageSource;
}

function normalizeTokens(value: number | null | undefined) {
	if (!Number.isFinite(value) || value == null || value < 0) {
		return 0;
	}

	return Math.floor(value);
}

function hasTokenCount(value: number | null | undefined) {
	return value != null && Number.isFinite(value) && value >= 0;
}

export function estimateOutputTokens({
	content,
	provider,
	model,
}: {
	content: string;
	provider: string;
	model: string;
}) {
	if (!content) {
		return 0;
	}

	return createTokenEstimator({
		providerName: provider,
		model,
	}).estimateTextTokens(content);
}

export function estimateInputTokens({
	messages,
	provider,
	model,
}: {
	messages: ProviderMessage[];
	provider: string;
	model: string;
}) {
	return createTokenEstimator({
		providerName: provider,
		model,
	}).estimateMessagesTokens(messages);
}

export function buildUsageMeasurement(
	input: BuildUsageMeasurementInput
): UsageMeasurement {
	const shouldEstimate =
		input.outcome === "completed" || Boolean(input.hasPartialOutput);
	const hasProviderInput = hasTokenCount(input.providerUsage?.promptTokens);
	const hasProviderOutput = hasTokenCount(
		input.providerUsage?.completionTokens
	);
	const inputTokens = hasProviderInput
		? normalizeTokens(input.providerUsage?.promptTokens)
		: shouldEstimate
			? normalizeTokens(input.estimatedInputTokens)
			: 0;
	const outputTokens = hasProviderOutput
		? normalizeTokens(input.providerUsage?.completionTokens)
		: shouldEstimate
			? normalizeTokens(input.estimatedOutputTokens)
			: 0;
	const usageSource =
		input.usageSourceOverride ??
		(hasProviderInput && hasProviderOutput
			? "provider"
			: shouldEstimate
				? "estimate"
				: hasProviderInput || hasProviderOutput
					? "provider"
					: "none");
	const cost = estimateUsageCost({
		requestedModel: input.requestedModel,
		resolvedModel: input.resolvedModel,
		inputTokens,
		outputTokens,
	});

	return {
		inputTokens,
		outputTokens,
		billableUnits: inputTokens + outputTokens,
		usageSource,
		resolvedModel: input.resolvedModel ?? null,
		providerRequestId: input.providerRequestId ?? null,
		...cost,
	};
}

export function createUsageAttempt({
	prismaClient = prisma,
	startedAt = new Date(),
	...input
}: CreateUsageAttemptInput) {
	return prismaClient.usageEvent.create({
		data: {
			...input,
			userId: input.userId ?? null,
			organizationId: input.organizationId ?? null,
			conversationId: input.conversationId ?? null,
			messageId: input.messageId ?? null,
			generationId: input.generationId ?? null,
			promptVersion: input.promptVersion ?? null,
			outcome: "pending",
			startedAt,
		},
	});
}

export async function finalizeUsageEventInTransaction({
	prismaClient,
	deduplicationKey,
	outcome,
	measurement,
	errorCode,
	providerStatusCode,
	finalizedAt = new Date(),
}: {
	prismaClient: UsagePrismaClient;
	deduplicationKey: string;
	outcome: Exclude<UsageOutcome, "pending">;
	measurement: UsageMeasurement;
	errorCode?: string | null;
	providerStatusCode?: number | null;
	finalizedAt?: Date;
}) {
	const existing = await prismaClient.usageEvent.findUnique({
		where: { deduplicationKey },
		select: {
			id: true,
			userId: true,
			conversationId: true,
			feature: true,
			provider: true,
			requestedModel: true,
			startedAt: true,
			outcome: true,
		},
	});

	if (!existing || existing.outcome !== "pending") {
		return false;
	}

	const updated = await prismaClient.usageEvent.updateMany({
		where: {
			id: existing.id,
			outcome: "pending",
		},
		data: {
			outcome,
			resolvedModel: measurement.resolvedModel,
			providerRequestId: measurement.providerRequestId,
			inputTokens: measurement.inputTokens,
			outputTokens: measurement.outputTokens,
			billableUnits: measurement.billableUnits,
			usageSource: measurement.usageSource,
			estimatedCostUsd: measurement.estimatedCostUsd,
			costIsEstimate: measurement.costIsEstimate,
			pricingVersion: measurement.pricingVersion,
			errorCode: errorCode ?? null,
			providerStatusCode: providerStatusCode ?? null,
			finalizedAt,
		},
	});

	if (updated.count !== 1 || !existing.userId) {
		if (updated.count === 1) {
			await recordUsageOperationalMetric({
				prismaClient,
				event: existing,
				outcome,
				measurement,
				errorCode,
				providerStatusCode,
				finalizedAt,
			});
		}
		return updated.count === 1;
	}

	const { start, end } = getUtcMonthWindow(finalizedAt);
	await prismaClient.quotaLedger.upsert({
		where: {
			subjectType_subjectId_windowStart_windowEnd: {
				subjectType: "user",
				subjectId: existing.userId,
				windowStart: start,
				windowEnd: end,
			},
		},
		update: {
			usedTokens: { increment: measurement.billableUnits },
			usedUsd: { increment: measurement.estimatedCostUsd ?? "0" },
		},
		create: {
			subjectType: "user",
			subjectId: existing.userId,
			windowStart: start,
			windowEnd: end,
			usedTokens: measurement.billableUnits,
			usedUsd: measurement.estimatedCostUsd ?? "0",
		},
	});

	await recordUsageOperationalMetric({
		prismaClient,
		event: existing,
		outcome,
		measurement,
		errorCode,
		providerStatusCode,
		finalizedAt,
	});

	return true;
}

export function finalizeUsageEvent({
	prismaClient = prisma,
	...input
}: Omit<
	Parameters<typeof finalizeUsageEventInTransaction>[0],
	"prismaClient"
> & { prismaClient?: UsagePrismaClient }) {
	return prismaClient.$transaction((transaction: UsagePrismaClient) =>
		finalizeUsageEventInTransaction({
			...input,
			prismaClient: transaction,
		})
	);
}

export function getStaleUsageTimeoutMs() {
	const configured = Number(process.env.USAGE_ATTEMPT_STALE_TIMEOUT_MS);
	return Number.isFinite(configured) && configured > 0
		? configured
		: DEFAULT_STALE_USAGE_TIMEOUT_MS;
}

export async function finalizeStaleUsageAttempts({
	prismaClient = prisma,
	now = new Date(),
	timeoutMs = getStaleUsageTimeoutMs(),
	dryRun = false,
}: {
	prismaClient?: UsagePrismaClient;
	now?: Date;
	timeoutMs?: number;
	dryRun?: boolean;
} = {}) {
	const attempts: Array<{
		deduplicationKey: string;
		requestedModel: string;
	}> = await prismaClient.usageEvent.findMany({
		where: {
			outcome: "pending",
			generationId: null,
			startedAt: { lt: new Date(now.getTime() - timeoutMs) },
		},
		select: {
			deduplicationKey: true,
			requestedModel: true,
		},
	});

	if (dryRun) {
		return { count: attempts.length };
	}

	let finalized = 0;
	for (const attempt of attempts) {
		const didFinalize = await finalizeUsageEvent({
			prismaClient,
			deduplicationKey: attempt.deduplicationKey,
			outcome: "failed",
			measurement: buildUsageMeasurement({
				requestedModel: attempt.requestedModel,
				outcome: "failed",
			}),
			errorCode: "USAGE_ATTEMPT_TIMEOUT",
			finalizedAt: now,
		});
		if (didFinalize) {
			finalized += 1;
		}
	}

	return { count: finalized };
}
