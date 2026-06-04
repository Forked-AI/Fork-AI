import type { ModelProvider } from "@/lib/ai/model-provider";
import { MistralProvider } from "@/lib/ai/providers/mistral-provider";

export type ModelProviderName = "mistral";

export interface ModelProviderSelection {
	providerName: ModelProviderName;
	provider: ModelProvider;
	model: string;
}

const SUPPORTED_MODELS: Record<string, string> = {
	"mistral-large": "mistral-large-latest",
	"mistral-large-latest": "mistral-large-latest",
	"mistral-small": "mistral-small-latest",
	"mistral-small-latest": "mistral-small-latest",
	codestral: "codestral-latest",
	"codestral-latest": "codestral-latest",
	"ministral-8b": "ministral-8b-latest",
	"ministral-8b-latest": "ministral-8b-latest",
	"ministral-3b": "ministral-3b-latest",
	"ministral-3b-latest": "ministral-3b-latest",
	"pixtral-large": "pixtral-large-latest",
	"pixtral-large-latest": "pixtral-large-latest",
	"open-mistral-nemo": "open-mistral-nemo",
};

let defaultMistralProvider: ModelProvider | null = null;

function getDefaultMistralProvider(): ModelProvider {
	defaultMistralProvider ??= new MistralProvider();
	return defaultMistralProvider;
}

export function getSupportedModelAliases(): string[] {
	return Object.keys(SUPPORTED_MODELS);
}

export function normalizeModelId(model: string): string | null {
	return SUPPORTED_MODELS[model] ?? null;
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
	};
}
