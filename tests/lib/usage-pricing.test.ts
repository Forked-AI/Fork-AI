import { estimateUsageCost, USAGE_PRICING_VERSION } from "@/lib/usage/pricing";
import { describe, expect, it } from "vitest";

describe("usage pricing", () => {
	it("uses the resolved model before the requested alias", () => {
		expect(
			estimateUsageCost({
				requestedModel: "mistral-small-latest",
				resolvedModel: "mistral-large-2512",
				inputTokens: 1_000_000,
				outputTokens: 1_000_000,
			})
		).toEqual({
			estimatedCostUsd: "2.00000000",
			pricingVersion: USAGE_PRICING_VERSION,
			costIsEstimate: true,
		});
	});

	it("falls back to the requested alias and keeps eight decimal places", () => {
		expect(
			estimateUsageCost({
				requestedModel: "codestral-latest",
				inputTokens: 10,
				outputTokens: 5,
			})
		).toMatchObject({
			estimatedCostUsd: "0.00000750",
			pricingVersion: USAGE_PRICING_VERSION,
		});
	});

	it("does not invent a zero cost for unknown models", () => {
		expect(
			estimateUsageCost({
				requestedModel: "unknown-model",
				inputTokens: 100,
				outputTokens: 50,
			})
		).toEqual({
			estimatedCostUsd: null,
			pricingVersion: null,
			costIsEstimate: true,
		});
	});
});
