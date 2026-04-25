import { prisma } from "./prisma";
import {
    resolveSubscriptionEntitlement,
    type BillingTier,
} from "./subscription";

export type UsageBand =
	| "low"
	| "moderate"
	| "high"
	| "near_limit"
	| "exhausted";

export interface TokenBudgetStatus {
	tier: BillingTier;
	usagePercent: number;
	usageBand: UsageBand;
	trialEndsAt: Date | null;
}

export interface TokenBudgetCheckResult extends TokenBudgetStatus {
	allowed: boolean;
}

const DEFAULT_CHARS_PER_TOKEN = 4;
const DEFAULT_COMPLETION_RESERVE = 800;

function parsePositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getCharsPerToken(): number {
	return parsePositiveInt(
		process.env.TOKEN_ESTIMATE_CHARS_PER_TOKEN,
		DEFAULT_CHARS_PER_TOKEN
	);
}

function getCompletionReserveTokens(): number {
	return parsePositiveInt(
		process.env.TOKEN_COMPLETION_RESERVE,
		DEFAULT_COMPLETION_RESERVE
	);
}

function toUsageBand(ratio: number): UsageBand {
	if (ratio >= 1) {
		return "exhausted";
	}
	if (ratio >= 0.9) {
		return "near_limit";
	}
	if (ratio >= 0.7) {
		return "high";
	}
	if (ratio >= 0.4) {
		return "moderate";
	}
	return "low";
}

function estimateTokensFromMessages(
	messages: Array<{ content: string }>
): number {
	const totalChars = messages.reduce(
		(sum, message) => sum + message.content.length,
		0
	);
	return Math.max(1, Math.ceil(totalChars / getCharsPerToken()));
}

async function getMonthlyUsedTokens(
	userId: string,
	windowStart: Date,
	windowEnd: Date
): Promise<number> {
	const usage = await prisma.message.aggregate({
		where: {
			role: "assistant",
			isError: false,
			createdAt: {
				gte: windowStart,
				lt: windowEnd,
			},
			conversation: {
				userId,
			},
		},
		_sum: {
			promptTokens: true,
			completionTokens: true,
		},
	});

	return (usage._sum.promptTokens ?? 0) + (usage._sum.completionTokens ?? 0);
}

export async function getTokenBudgetStatus(
	userId: string
): Promise<TokenBudgetStatus> {
	const entitlement = await resolveSubscriptionEntitlement(userId);
	const usedTokens = await getMonthlyUsedTokens(
		userId,
		entitlement.usageWindowStart,
		entitlement.usageWindowEnd
	);
	const usageRatio =
		entitlement.monthlyTokenBudget > 0
			? usedTokens / entitlement.monthlyTokenBudget
			: 1;

	return {
		tier: entitlement.tier,
		usagePercent: Math.max(0, Math.min(100, Math.round(usageRatio * 100))),
		usageBand: toUsageBand(usageRatio),
		trialEndsAt: entitlement.trialEndsAt,
	};
}

export async function checkTokenBudgetBeforeRequest(
	userId: string,
	messagesForEstimate: Array<{ content: string }>
): Promise<TokenBudgetCheckResult> {
	const entitlement = await resolveSubscriptionEntitlement(userId);
	const usedTokens = await getMonthlyUsedTokens(
		userId,
		entitlement.usageWindowStart,
		entitlement.usageWindowEnd
	);
	const estimatedPromptTokens = estimateTokensFromMessages(messagesForEstimate);
	const estimatedRequestTokens =
		estimatedPromptTokens + getCompletionReserveTokens();
	const allowed =
		usedTokens + estimatedRequestTokens <= entitlement.monthlyTokenBudget;
	const usageRatio =
		entitlement.monthlyTokenBudget > 0
			? usedTokens / entitlement.monthlyTokenBudget
			: 1;

	return {
		allowed,
		tier: entitlement.tier,
		usagePercent: Math.max(0, Math.min(100, Math.round(usageRatio * 100))),
		usageBand: toUsageBand(usageRatio),
		trialEndsAt: entitlement.trialEndsAt,
	};
}
