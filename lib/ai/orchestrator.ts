import type { ModelProvider } from "@/lib/ai/model-provider";
import type { ModelCapabilities } from "@/lib/ai/model-catalog";
export type { ModelCapabilities } from "@/lib/ai/model-catalog";
import {
	getModelCapabilities,
	getSupportedModelAliases as getCatalogSupportedModelAliases,
	normalizeModelId as normalizeCatalogModelId,
} from "@/lib/ai/model-catalog";
import { MistralProvider } from "@/lib/ai/providers/mistral-provider";
import type { ModelAccessTier } from "@/lib/model-entitlements";
import { isModelIncludedInPlan } from "@/lib/model-entitlements";

export type ModelProviderName = "mistral";

export interface ModelProviderSelection {
	providerName: ModelProviderName;
	provider: ModelProvider;
	model: string;
	capabilities: ModelCapabilities;
}

let defaultMistralProvider: ModelProvider | null = null;

function getDefaultMistralProvider(): ModelProvider {
	defaultMistralProvider ??= new MistralProvider();
	return defaultMistralProvider;
}

export function getSupportedModelAliases(): string[] {
	return getCatalogSupportedModelAliases();
}

export function normalizeModelId(model: string): string | null {
	return normalizeCatalogModelId(model);
}

export function selectModelProvider(
	model: string,
	providers: Partial<Record<ModelProviderName, ModelProvider>> = {}
): ModelProviderSelection | null {
	const normalizedModel = normalizeModelId(model);

	if (!normalizedModel) {
		return null;
	}

	return {
		providerName: "mistral",
		provider: providers.mistral ?? getDefaultMistralProvider(),
		model: normalizedModel,
		capabilities: getModelCapabilities(normalizedModel),
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
	if (!normalizedModel || !isFallbackEligibleModel(normalizedModel)) {
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
