import type { ModelCapabilities } from "@/lib/ai/model-catalog";
import type { AiTaskId } from "@/lib/ai/version-taxonomy";

export const MODEL_PROVIDER_NAMES = [
	"mistral",
	"openai",
	"anthropic",
	"gemini",
] as const;

export type ModelProviderName = (typeof MODEL_PROVIDER_NAMES)[number];

export type ModelRolloutState =
	| "disabled"
	| "shadow"
	| "canary"
	| "default"
	| "deprecated";

export interface ProviderCapabilityProfile {
	textGeneration: boolean;
	streaming: boolean;
	structuredOutput: boolean;
	functionCalling: boolean;
	nativeWebSearch: boolean;
	embeddings: boolean;
	documentAi: boolean;
	moderation: boolean;
	promptCaching: boolean;
	imageInput: boolean;
	audioInput: boolean;
	audioTranscription: boolean;
}

export interface ModelRouteConfig {
	id: string;
	aliases: readonly string[];
	providerName: ModelProviderName;
	providerModel: string;
	rolloutState: ModelRolloutState;
	tasks: readonly AiTaskId[];
	capabilities: ModelCapabilities;
	evalBaseline: {
		datasetVersion: string;
		reportPath: string;
		status: "required" | "mocked" | "passed";
	};
	hostedKeySupported: boolean;
	byokSupported: boolean;
	dataRetention: "hosted-standard" | "deferred";
	rollback: {
		disableEnv: string;
		disableValue: string;
	};
}

export interface ModelRouteDecision {
	config: ModelRouteConfig;
	providerName: ModelProviderName;
	providerModel: string;
	requestedModel: string;
	rolloutState: ModelRolloutState;
	taskId: AiTaskId;
	capabilities: ModelCapabilities;
	fallbackPolicy: {
		crossProviderFallbackEnabled: boolean;
		sameProviderFallbackModels: string[];
	};
}
