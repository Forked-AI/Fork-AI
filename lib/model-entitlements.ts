import type { BillingTier } from "@/lib/subscription";

export type ModelAccessTier = BillingTier | "guest";

const BASIC_MODELS = new Set([
	"mistral-large-latest",
	"mistral-large-2512",
	"mistral-small-latest",
	"mistral-small-2603",
	"ministral-8b-latest",
	"ministral-8b-2512",
	"ministral-3b-latest",
	"ministral-3b-2512",
	"open-mistral-nemo",
	"open-mistral-nemo-2407",
]);

export function isModelIncludedInPlan(
	tier: ModelAccessTier,
	model: string
): boolean {
	if (tier === "pro") {
		return true;
	}

	return BASIC_MODELS.has(model);
}

export function getModelAccessError(tier: ModelAccessTier, model: string) {
	return {
		error: "This model is not included in your current plan.",
		errorCode: "MODEL_NOT_INCLUDED_IN_PLAN",
		plan: { tier },
		model,
	};
}
