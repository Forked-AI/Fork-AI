import type { ModelProvider } from "@/lib/ai/model-provider";
import type { ModelCapabilities } from "@/lib/ai/model-catalog";
export type { ModelCapabilities } from "@/lib/ai/model-catalog";
import {
	getModelCapabilities,
	normalizeModelId as normalizeCatalogModelId,
} from "@/lib/ai/model-catalog";
import {
	AI_GATEWAY_ROUTE_POLICY_VERSION,
	getSupportedGatewayModelAliases,
	resolveModelRouteDecision,
} from "@/lib/ai/gateway/registry";
import {
	AUTO_MODEL_ID,
	type AutoModelRoutingReason,
	type AutoModelRoutingSignals,
	isAutoModelRequest,
	resolveAutoModelRoute,
} from "@/lib/ai/auto-model-routing";
import type { ModelProviderName } from "@/lib/ai/gateway/types";
import { MistralProvider } from "@/lib/ai/providers/mistral-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import type { AiTaskId } from "@/lib/ai/version-taxonomy";
import type { ModelAccessTier } from "@/lib/model-entitlements";
import { isModelIncludedInPlan } from "@/lib/model-entitlements";

export interface ModelProviderSelection {
	providerName: ModelProviderName;
	provider: ModelProvider;
	model: string;
	capabilities: ModelCapabilities;
	routePolicyVersion: string;
	rolloutState: string;
	requestedModel: string;
	autoRouted: boolean;
	autoRoutingReason?: AutoModelRoutingReason;
}

let defaultMistralProvider: ModelProvider | null = null;
let defaultOpenAIProvider: ModelProvider | null = null;

function getDefaultMistralProvider(): ModelProvider {
	defaultMistralProvider ??= new MistralProvider();
	return defaultMistralProvider;
}

function getDefaultOpenAIProvider(): ModelProvider {
	defaultOpenAIProvider ??= new OpenAIProvider();
	return defaultOpenAIProvider;
}

function getDefaultProvider(providerName: ModelProviderName): ModelProvider {
	if (providerName === "mistral") {
		return getDefaultMistralProvider();
	}

	if (providerName === "openai") {
		return getDefaultOpenAIProvider();
	}

	throw new Error(`Provider ${providerName} is not implemented`);
}

export function getSupportedModelAliases(): string[] {
	return [AUTO_MODEL_ID, ...getSupportedGatewayModelAliases()];
}

export function normalizeModelId(model: string): string | null {
	return normalizeCatalogModelId(model);
}

export function selectModelProvider(
	model: string,
	providers: Partial<Record<ModelProviderName, ModelProvider>> = {},
	options: { taskId?: AiTaskId; autoRouting?: AutoModelRoutingSignals } = {}
): ModelProviderSelection | null {
	const autoRoutingDecision = isAutoModelRequest(model)
		? resolveAutoModelRoute(
				options.autoRouting ?? {
					message: "",
				}
			)
		: null;
	const requestedModel = model;
	const selectedModel = autoRoutingDecision?.model ?? model;
	const decision = resolveModelRouteDecision({
		model: selectedModel,
		taskId: options.taskId ?? "chat.general",
	});
	if (!decision) {
		return null;
	}

	const provider =
		providers[decision.providerName] ??
		getDefaultProvider(decision.providerName);

	return {
		providerName: decision.providerName,
		provider,
		model: decision.providerModel,
		capabilities: decision.capabilities,
		routePolicyVersion: AI_GATEWAY_ROUTE_POLICY_VERSION,
		rolloutState: decision.rolloutState,
		requestedModel,
		autoRouted: Boolean(autoRoutingDecision),
		autoRoutingReason: autoRoutingDecision?.reason,
	};
}

const FALLBACK_MODELS = [
	"mistral-small-latest",
	"ministral-8b-latest",
	"open-mistral-nemo",
];
function isFallbackEligibleModel(model: string) {
	return (
		/^mistral-(large|medium|small)-/.test(model) ||
		/^ministral-(14b|8b|3b)-/.test(model) ||
		model.startsWith("open-mistral-nemo")
	);
}

export function getModelFallbackCandidates(options: {
	model: string;
	tier: ModelAccessTier;
	requiredCapabilities: ModelCapabilities;
}) {
	const normalizedModel = normalizeModelId(options.model);
	const decision = normalizedModel
		? resolveModelRouteDecision({ model: normalizedModel })
		: null;
	if (
		!normalizedModel ||
		!decision ||
		decision.providerName !== "mistral" ||
		!isFallbackEligibleModel(normalizedModel)
	) {
		return [];
	}

	return FALLBACK_MODELS.filter((candidate) => {
		if (candidate === normalizedModel) return false;
		if (!isModelIncludedInPlan(options.tier, candidate)) return false;
		const capabilities = getModelCapabilities(candidate);
		if (
			options.requiredCapabilities.supportsImages &&
			!capabilities.supportsImages
		) {
			return false;
		}
		if (
			options.requiredCapabilities.supportsAudioInput &&
			!capabilities.supportsAudioInput
		) {
			return false;
		}
		return capabilities.supportsText;
	});
}
