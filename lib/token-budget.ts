import { prisma } from "./prisma";
import {
	resolveSubscriptionEntitlement,
	type BillingTier,
} from "./subscription";
import type { ProviderMessageContent } from "./chat-system-prompt";

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
const DEFAULT_IMAGE_INPUT_TOKENS = 1000;

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

function estimateContentTokens(content: ProviderMessageContent): number {
	if (typeof content === "string") {
		return Math.max(1, Math.ceil(content.length / getCharsPerToken()));
	}

	return content.reduce((total, part) => {
		if (part.type === "text") {
			return (
				total +
				Math.max(1, Math.ceil(part.text.length / getCharsPerToken()))
			);
		}

		return total + DEFAULT_IMAGE_INPUT_TOKENS;
	}, 0);
}

function estimateTokensFromMessages(
	messages: Array<{ content: ProviderMessageContent }>
): number {
	return Math.max(
		1,
		messages.reduce(
			(sum, message) => sum + estimateContentTokens(message.content),
			0
		)
	);
}

async function getMonthlyUsedTokens(
	subjectType: "user" | "organization",
	subjectId: string,
	windowStart: Date,
	windowEnd: Date
): Promise<number> {
	const usage = await prisma.quotaLedger.findUnique({
		where: {
			subjectType_subjectId_windowStart_windowEnd: {
				subjectType,
				subjectId,
				windowStart,
				windowEnd,
			},
		},
		select: { usedTokens: true },
	});

	return usage?.usedTokens ?? 0;
}

export async function getTokenBudgetStatus(
	userId: string,
	organizationId?: string | null
): Promise<TokenBudgetStatus> {
	const entitlement = await resolveSubscriptionEntitlement(userId);
	const usedTokens = await getMonthlyUsedTokens(
		organizationId ? "organization" : "user",
		organizationId ?? userId,
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
	messagesForEstimate: Array<{ content: ProviderMessageContent }>,
	organizationId?: string | null
): Promise<TokenBudgetCheckResult> {
	const entitlement = await resolveSubscriptionEntitlement(userId);
	const usedTokens = await getMonthlyUsedTokens(
		organizationId ? "organization" : "user",
		organizationId ?? userId,
		entitlement.usageWindowStart,
		entitlement.usageWindowEnd
	);
	const estimatedPromptTokens =
		estimateTokensFromMessages(messagesForEstimate);
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
