import {
	CHAT_MODELS,
	getChatModelMetadata,
	normalizeModelId,
	type ModelCapabilities,
} from "@/lib/ai/model-catalog";
import type {
	ModelProviderName,
	ModelRolloutState,
	ModelRouteConfig,
	ModelRouteDecision,
	ProviderCapabilityProfile,
} from "@/lib/ai/gateway/types";
import type { AiTaskId } from "@/lib/ai/version-taxonomy";

export const AI_GATEWAY_ROUTE_POLICY_VERSION = "ai-gateway-route-v1";

const CHAT_TASKS: readonly AiTaskId[] = [
	"chat.general",
	"chat.reasoning",
	"chat.code",
	"rag.qa",
];

const SUMMARY_TASKS: readonly AiTaskId[] = [
	"share.summary",
	"conversation.title",
];

const DEFAULT_TASKS: readonly AiTaskId[] = [...CHAT_TASKS, ...SUMMARY_TASKS];

const ROLLOUT_SELECTABLE_STATES = new Set<ModelRolloutState>([
	"canary",
	"default",
	"deprecated",
]);

function toProviderName(provider: string): ModelProviderName {
	const normalized = provider.trim().toLowerCase();
	if (
		normalized === "mistral" ||
		normalized === "openai" ||
		normalized === "anthropic" ||
		normalized === "gemini"
	) {
		return normalized;
	}

	return "mistral";
}

function toProviderCapabilities(
	capabilities: ModelCapabilities
): ProviderCapabilityProfile {
	return {
		textGeneration: capabilities.supportsText,
		streaming: capabilities.supportsStreaming,
		structuredOutput: capabilities.supportsStructuredOutput,
		functionCalling: capabilities.supportsFunctionCalling,
		nativeWebSearch: capabilities.supportsNativeWebSearch,
		embeddings: capabilities.supportsEmbeddings,
		documentAi: capabilities.supportsDocumentAi,
		moderation: capabilities.supportsModeration,
		promptCaching: capabilities.supportsPromptCaching,
		imageInput: capabilities.supportsImages,
		audioInput: capabilities.supportsAudioInput,
		audioTranscription: capabilities.supportsAudioTranscription,
	};
}

function buildMistralRouteConfigs(): ModelRouteConfig[] {
	return CHAT_MODELS.filter(
		(model) => toProviderName(model.provider) === "mistral"
	).map((model) => ({
		id: model.resolvedId,
		aliases: [model.id, model.resolvedId],
		providerName: "mistral",
		providerModel: model.resolvedId,
		rolloutState: "default",
		tasks: DEFAULT_TASKS,
		capabilities: model.capabilities,
		evalBaseline: {
			datasetVersion: "ci-smoke.v1",
			reportPath: "evals/baselines/ci-smoke.v1.json",
			status: "passed",
		},
		hostedKeySupported: true,
		byokSupported: false,
		dataRetention: "hosted-standard",
		rollback: {
			disableEnv: "AI_MODEL_ROLLOUT_OVERRIDES",
			disableValue: `${model.resolvedId}=disabled`,
		},
	}));
}

const STATIC_ROUTE_CONFIGS: ModelRouteConfig[] = [
	{
		id: "gpt-5.1",
		aliases: ["gpt-5.1", "openai:gpt-5.1"],
		providerName: "openai",
		providerModel: "gpt-5.1",
		rolloutState: "shadow",
		tasks: DEFAULT_TASKS,
		capabilities:
			getChatModelMetadata("gpt-5.1")?.capabilities ??
			getChatModelMetadata("mistral-large")!.capabilities,
		evalBaseline: {
			datasetVersion: "phase3-openai-contract.v1",
			reportPath: "evals/reports/phase3-openai-offline-contract.json",
			status: "mocked",
		},
		hostedKeySupported: true,
		byokSupported: false,
		dataRetention: "hosted-standard",
		rollback: {
			disableEnv: "AI_MODEL_ROLLOUT_OVERRIDES",
			disableValue: "gpt-5.1=disabled",
		},
	},
];

function parseRolloutOverrides() {
	const overrides = new Map<string, ModelRolloutState>();
	const raw = process.env.AI_MODEL_ROLLOUT_OVERRIDES?.trim();
	if (!raw) return overrides;

	for (const entry of raw.split(",")) {
		const [rawModel, rawState] = entry.split("=");
		const model = rawModel?.trim().toLowerCase();
		const state = rawState?.trim().toLowerCase() as ModelRolloutState;
		if (
			model &&
			["disabled", "shadow", "canary", "default", "deprecated"].includes(
				state
			)
		) {
			overrides.set(model, state);
		}
	}

	return overrides;
}

export function getModelRouteConfigs(): ModelRouteConfig[] {
	const overrides = parseRolloutOverrides();

	return [...buildMistralRouteConfigs(), ...STATIC_ROUTE_CONFIGS].map(
		(config) => {
			const override =
				overrides.get(config.id.toLowerCase()) ??
				overrides.get(config.providerModel.toLowerCase()) ??
				config.aliases
					.map((alias) => overrides.get(alias.toLowerCase()))
					.find(Boolean);

			return override ? { ...config, rolloutState: override } : config;
		}
	);
}

export function getProviderCapabilityProfiles(): Record<
	ModelProviderName,
	ProviderCapabilityProfile
> {
	const profiles = {
		mistral: emptyProviderCapabilities(),
		openai: emptyProviderCapabilities(),
		anthropic: emptyProviderCapabilities(),
		gemini: emptyProviderCapabilities(),
	};

	for (const config of getModelRouteConfigs()) {
		const profile = toProviderCapabilities(config.capabilities);
		for (const key of Object.keys(profile) as Array<
			keyof ProviderCapabilityProfile
		>) {
			profiles[config.providerName][key] ||= profile[key];
		}
	}

	return profiles;
}

function emptyProviderCapabilities(): ProviderCapabilityProfile {
	return {
		textGeneration: false,
		streaming: false,
		structuredOutput: false,
		functionCalling: false,
		nativeWebSearch: false,
		embeddings: false,
		documentAi: false,
		moderation: false,
		promptCaching: false,
		imageInput: false,
		audioInput: false,
		audioTranscription: false,
	};
}

export function resolveModelRouteDecision({
	model,
	taskId = "chat.general",
}: {
	model: string;
	taskId?: AiTaskId;
}): ModelRouteDecision | null {
	const normalizedModel = normalizeModelId(model) ?? model;
	const normalizedRequest = model.trim().toLowerCase();
	const normalizedResolved = normalizedModel.trim().toLowerCase();
	const config = getModelRouteConfigs().find((candidate) => {
		if (!candidate.tasks.includes(taskId)) return false;
		return (
			candidate.id.toLowerCase() === normalizedResolved ||
			candidate.providerModel.toLowerCase() === normalizedResolved ||
			candidate.aliases.some(
				(alias) =>
					alias.toLowerCase() === normalizedRequest ||
					alias.toLowerCase() === normalizedResolved
			)
		);
	});

	if (!config || !ROLLOUT_SELECTABLE_STATES.has(config.rolloutState)) {
		return null;
	}

	return {
		config,
		providerName: config.providerName,
		providerModel: config.providerModel,
		requestedModel: model,
		rolloutState: config.rolloutState,
		taskId,
		capabilities: config.capabilities,
		fallbackPolicy: {
			crossProviderFallbackEnabled: false,
			sameProviderFallbackModels: [],
		},
	};
}

export function getSupportedGatewayModelAliases(): string[] {
	return getModelRouteConfigs()
		.filter((config) => ROLLOUT_SELECTABLE_STATES.has(config.rolloutState))
		.flatMap((config) => [...config.aliases, config.providerModel]);
}

export function getProviderHealthRows() {
	const configs = getModelRouteConfigs();
	return configs.map((config) => ({
		provider: config.providerName,
		model: config.providerModel,
		rolloutState: config.rolloutState,
		evalDatasetVersion: config.evalBaseline.datasetVersion,
		evalReportPath: config.evalBaseline.reportPath,
		evalStatus: config.evalBaseline.status,
		hostedKeySupported: config.hostedKeySupported,
		byokSupported: config.byokSupported,
		dataRetention: config.dataRetention,
		rollbackEnv: config.rollback.disableEnv,
		rollbackValue: config.rollback.disableValue,
	}));
}
