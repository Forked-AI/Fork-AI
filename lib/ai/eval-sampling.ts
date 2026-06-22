import { createHash } from "node:crypto";

export const AI_EVAL_SAMPLING_POLICY_VERSION = "ai-eval-sampling-v1";

export interface EvalSamplingPolicy {
	enabled: boolean;
	rate: number;
	maxPromptChars: number;
	allowedTasks: string[];
	liveProviderBudgetUsd: number;
}

export const defaultEvalSamplingPolicy: EvalSamplingPolicy = {
	enabled: process.env.AI_SHADOW_EVAL_ENABLED === "true",
	rate: Number(process.env.AI_SHADOW_EVAL_RATE ?? "0.01"),
	maxPromptChars: Number(
		process.env.AI_SHADOW_EVAL_MAX_PROMPT_CHARS ?? "4000"
	),
	allowedTasks: ["chat.general", "rag.qa", "tool.plan"],
	liveProviderBudgetUsd: Number(
		process.env.AI_LIVE_EVAL_DAILY_BUDGET_USD ?? "0"
	),
};

function stableUnitInterval(seed: string) {
	const hash = createHash("sha256").update(seed).digest("hex").slice(0, 12);
	return Number.parseInt(hash, 16) / 0xffffffffffff;
}

export function shouldSampleForShadowEval(input: {
	requestId: string;
	userId: string;
	taskId: string;
	promptLength: number;
	policy?: EvalSamplingPolicy;
}) {
	const policy = input.policy ?? defaultEvalSamplingPolicy;
	if (!policy.enabled) return { sample: false as const, reason: "disabled" };
	if (!policy.allowedTasks.includes(input.taskId)) {
		return { sample: false as const, reason: "task_not_allowed" };
	}
	if (input.promptLength > policy.maxPromptChars) {
		return { sample: false as const, reason: "prompt_too_large" };
	}
	if (policy.liveProviderBudgetUsd <= 0) {
		return { sample: false as const, reason: "budget_unavailable" };
	}

	const score = stableUnitInterval(
		`${AI_EVAL_SAMPLING_POLICY_VERSION}:${input.userId}:${input.requestId}:${input.taskId}`
	);
	return score < policy.rate
		? { sample: true as const, reason: "sampled", score }
		: { sample: false as const, reason: "rate_excluded", score };
}

export function buildPrivacySafeEvalTrace(input: {
	taskId: string;
	promptVersion?: string | null;
	retrievalConfigVersion?: string | null;
	embeddingConfigVersion?: string | null;
	toolRegistryVersion?: string | null;
	safetyPolicyVersion?: string | null;
	modelRoutePolicyVersion?: string | null;
	promptLength: number;
	outputLength?: number | null;
	retrievalConfidence?: string | null;
	citationValidationFailureCount?: number;
	fallbackUsed?: boolean;
}) {
	return {
		taskId: input.taskId,
		promptVersion: input.promptVersion ?? null,
		retrievalConfigVersion: input.retrievalConfigVersion ?? null,
		embeddingConfigVersion: input.embeddingConfigVersion ?? null,
		toolRegistryVersion: input.toolRegistryVersion ?? null,
		safetyPolicyVersion: input.safetyPolicyVersion ?? null,
		modelRoutePolicyVersion: input.modelRoutePolicyVersion ?? null,
		promptLength: input.promptLength,
		outputLength: input.outputLength ?? null,
		retrievalConfidence: input.retrievalConfidence ?? null,
		citationValidationFailureCount:
			input.citationValidationFailureCount ?? 0,
		fallbackUsed: input.fallbackUsed ?? false,
		policyVersion: AI_EVAL_SAMPLING_POLICY_VERSION,
	};
}
