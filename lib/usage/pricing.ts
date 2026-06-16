export const USAGE_PRICING_VERSION = "mistral-2026-06-05";

interface ModelPrice {
	inputUsdPerMillionTokens: number;
	outputUsdPerMillionTokens: number;
}

const MODEL_PRICES: Record<string, ModelPrice> = {
	"mistral-large-2512": {
		inputUsdPerMillionTokens: 0.5,
		outputUsdPerMillionTokens: 1.5,
	},
	"mistral-large-latest": {
		inputUsdPerMillionTokens: 0.5,
		outputUsdPerMillionTokens: 1.5,
	},
	"mistral-small-2603": {
		inputUsdPerMillionTokens: 0.15,
		outputUsdPerMillionTokens: 0.6,
	},
	"mistral-small-latest": {
		inputUsdPerMillionTokens: 0.15,
		outputUsdPerMillionTokens: 0.6,
	},
	"mistral-medium-latest": {
		inputUsdPerMillionTokens: 1.5,
		outputUsdPerMillionTokens: 7.5,
	},
	"mistral-medium-2604": {
		inputUsdPerMillionTokens: 1.5,
		outputUsdPerMillionTokens: 7.5,
	},
	"mistral-medium-3-5": {
		inputUsdPerMillionTokens: 1.5,
		outputUsdPerMillionTokens: 7.5,
	},
	"mistral-medium-2508": {
		inputUsdPerMillionTokens: 1.5,
		outputUsdPerMillionTokens: 7.5,
	},
	"codestral-2508": {
		inputUsdPerMillionTokens: 0.3,
		outputUsdPerMillionTokens: 0.9,
	},
	"codestral-latest": {
		inputUsdPerMillionTokens: 0.3,
		outputUsdPerMillionTokens: 0.9,
	},
	"ministral-3b-2512": {
		inputUsdPerMillionTokens: 0.1,
		outputUsdPerMillionTokens: 0.1,
	},
	"ministral-3b-latest": {
		inputUsdPerMillionTokens: 0.1,
		outputUsdPerMillionTokens: 0.1,
	},
	"ministral-14b-2512": {
		inputUsdPerMillionTokens: 0.2,
		outputUsdPerMillionTokens: 0.2,
	},
	"ministral-14b-latest": {
		inputUsdPerMillionTokens: 0.2,
		outputUsdPerMillionTokens: 0.2,
	},
	"ministral-8b-2512": {
		inputUsdPerMillionTokens: 0.15,
		outputUsdPerMillionTokens: 0.15,
	},
	"ministral-8b-latest": {
		inputUsdPerMillionTokens: 0.15,
		outputUsdPerMillionTokens: 0.15,
	},
	"open-mistral-nemo-2407": {
		inputUsdPerMillionTokens: 0.15,
		outputUsdPerMillionTokens: 0.15,
	},
	"open-mistral-nemo": {
		inputUsdPerMillionTokens: 0.15,
		outputUsdPerMillionTokens: 0.15,
	},
	"voxtral-mini-latest": {
		inputUsdPerMillionTokens: 0.1,
		outputUsdPerMillionTokens: 0.3,
	},
	"voxtral-small-latest": {
		inputUsdPerMillionTokens: 0.1,
		outputUsdPerMillionTokens: 0.3,
	},
};

export interface UsageCostEstimate {
	estimatedCostUsd: string | null;
	pricingVersion: string | null;
	costIsEstimate: boolean;
}

function normalizeTokenCount(value: number | null | undefined) {
	if (!Number.isFinite(value) || !value || value < 0) {
		return 0;
	}

	return Math.floor(value);
}

export function estimateUsageCost({
	requestedModel,
	resolvedModel,
	inputTokens,
	outputTokens,
}: {
	requestedModel: string;
	resolvedModel?: string | null;
	inputTokens: number;
	outputTokens: number;
}): UsageCostEstimate {
	const price =
		(resolvedModel
			? MODEL_PRICES[resolvedModel.toLowerCase()]
			: undefined) ?? MODEL_PRICES[requestedModel.toLowerCase()];

	if (!price) {
		return {
			estimatedCostUsd: null,
			pricingVersion: null,
			costIsEstimate: true,
		};
	}

	const inputCost =
		(normalizeTokenCount(inputTokens) / 1_000_000) *
		price.inputUsdPerMillionTokens;
	const outputCost =
		(normalizeTokenCount(outputTokens) / 1_000_000) *
		price.outputUsdPerMillionTokens;

	return {
		estimatedCostUsd: (inputCost + outputCost).toFixed(8),
		pricingVersion: USAGE_PRICING_VERSION,
		costIsEstimate: true,
	};
}
