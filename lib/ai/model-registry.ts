import { z } from "zod";
import { AI_GATEWAY_ROUTE_POLICY_VERSION } from "@/lib/ai/gateway/registry";

export const MODEL_REGISTRY_VERSION = "model-registry-v1";

export const modelRegistryRecordSchema = z.object({
	id: z.string().min(1),
	provider: z.enum(["mistral", "openai", "anthropic", "gemini", "custom"]),
	providerModel: z.string().min(1),
	capabilities: z.array(z.string().min(1)),
	contextWindow: z.number().int().positive(),
	pricingSnapshot: z.object({
		inputUsdPerMillionTokens: z.number().min(0),
		outputUsdPerMillionTokens: z.number().min(0),
		version: z.string().min(1),
	}),
	safetyNotes: z.array(z.string().min(1)),
	evalBaseline: z.object({
		datasetVersion: z.string().min(1),
		reportPath: z.string().min(1),
		status: z.enum(["missing", "passed", "failed", "deferred"]),
	}),
	rolloutState: z.enum([
		"disabled",
		"shadow",
		"canary",
		"default",
		"deprecated",
	]),
	owner: z.string().min(1),
});

export type ModelRegistryRecord = z.infer<typeof modelRegistryRecordSchema>;

export const modelRegistry: ModelRegistryRecord[] = [
	{
		id: "mistral-small-latest",
		provider: "mistral",
		providerModel: "mistral-small-latest",
		capabilities: ["text_generation", "streaming", "tool_context"],
		contextWindow: 32_000,
		pricingSnapshot: {
			inputUsdPerMillionTokens: 0.2,
			outputUsdPerMillionTokens: 0.6,
			version: "ai-gateway-2026-06-22",
		},
		safetyNotes: [
			"Hosted provider key only; no browser exposure.",
			"Provider-native tools disabled; ForkAI tool audit remains authoritative.",
		],
		evalBaseline: {
			datasetVersion: "ci-smoke.v2",
			reportPath: "evals/baselines/ci-smoke.v2.json",
			status: "passed",
		},
		rolloutState: "default",
		owner: "ai-platform",
	},
	{
		id: "gpt-5.1",
		provider: "openai",
		providerModel: "gpt-5.1",
		capabilities: ["text_generation", "streaming", "structured_output"],
		contextWindow: 128_000,
		pricingSnapshot: {
			inputUsdPerMillionTokens: 1.25,
			outputUsdPerMillionTokens: 10,
			version: "ai-gateway-2026-06-22",
		},
		safetyNotes: [
			"Controlled rollout only.",
			"Cross-provider fallback remains disabled until retention policy is accepted.",
		],
		evalBaseline: {
			datasetVersion: "phase3-openai-offline-contract",
			reportPath: "evals/reports/phase3-openai-offline-contract.json",
			status: "passed",
		},
		rolloutState: "shadow",
		owner: "ai-platform",
	},
];

export function validateModelRegistry(records = modelRegistry) {
	return records.map((record) => modelRegistryRecordSchema.parse(record));
}

export function getModelRegistrySummary() {
	return {
		version: MODEL_REGISTRY_VERSION,
		routePolicyVersion: AI_GATEWAY_ROUTE_POLICY_VERSION,
		models: validateModelRegistry().map((record) => ({
			id: record.id,
			provider: record.provider,
			rolloutState: record.rolloutState,
			evalStatus: record.evalBaseline.status,
			owner: record.owner,
		})),
	};
}
