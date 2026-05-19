import type { BillingTier } from "@/lib/subscription";

export type ModelAccessTier = BillingTier | "guest";

const BASIC_MODELS = new Set([
	"mistral-large-latest",
	"mistral-small-latest",
	"ministral-8b-latest",
	"ministral-3b-latest",
	"open-mistral-nemo",
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
