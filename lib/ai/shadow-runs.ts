import { randomUUID } from "node:crypto";
import {
	buildPrivacySafeEvalTrace,
	shouldSampleForShadowEval,
	type EvalSamplingPolicy,
} from "@/lib/ai/eval-sampling";
import { recordOperationalMetric } from "@/lib/operational-metrics";

export const AI_SHADOW_RUN_POLICY_VERSION = "ai-shadow-run-v1";

export interface ShadowRunRequest {
	userId: string;
	organizationId?: string | null;
	conversationId?: string | null;
	taskId: string;
	promptLength: number;
	promptVersion?: string | null;
	retrievalConfigVersion?: string | null;
	embeddingConfigVersion?: string | null;
	toolRegistryVersion?: string | null;
	safetyPolicyVersion?: string | null;
	modelRoutePolicyVersion?: string | null;
	retrievalConfidence?: string | null;
	citationValidationFailureCount?: number;
	fallbackUsed?: boolean;
	model: string;
	provider: string;
	requestId?: string;
	policy?: EvalSamplingPolicy;
}

export async function planShadowRun(input: ShadowRunRequest) {
	const requestId = input.requestId ?? randomUUID();
	const sampling = shouldSampleForShadowEval({
		requestId,
		userId: input.userId,
		taskId: input.taskId,
		promptLength: input.promptLength,
		policy: input.policy,
	});
	const trace = buildPrivacySafeEvalTrace({
		taskId: input.taskId,
		promptLength: input.promptLength,
		promptVersion: input.promptVersion,
		retrievalConfigVersion: input.retrievalConfigVersion,
		embeddingConfigVersion: input.embeddingConfigVersion,
		toolRegistryVersion: input.toolRegistryVersion,
		safetyPolicyVersion: input.safetyPolicyVersion,
		modelRoutePolicyVersion:
			input.modelRoutePolicyVersion ?? AI_SHADOW_RUN_POLICY_VERSION,
		retrievalConfidence: input.retrievalConfidence,
		citationValidationFailureCount: input.citationValidationFailureCount,
		fallbackUsed: input.fallbackUsed,
	});

	await recordOperationalMetric({
		kind: "ai_shadow_run",
		source: input.taskId,
		status: sampling.sample ? "planned" : "skipped",
		provider: input.provider,
		model: input.model,
		userId: input.userId,
		organizationId: input.organizationId ?? null,
		conversationId: input.conversationId ?? null,
		traceId: requestId,
		metadata: {
			...trace,
			reason: sampling.reason,
			sideEffectFree: true,
		},
	});

	return {
		requestId,
		sample: sampling.sample,
		reason: sampling.reason,
		sideEffectFree: true as const,
		policyVersion: AI_SHADOW_RUN_POLICY_VERSION,
	};
}
