import type { ModelProvider } from "@/lib/ai/model-provider";
import {
	getModelFallbackCandidates,
	getSupportedModelAliases,
	normalizeModelId,
	selectModelProvider,
} from "@/lib/ai/orchestrator";
import { afterEach, describe, expect, it, vi } from "vitest";

const fakeProvider: ModelProvider = {
	complete: vi.fn(),
	stream: vi.fn(),
};

describe("AI orchestrator provider selection", () => {
	afterEach(() => {
		delete process.env.AI_MODEL_ROLLOUT_OVERRIDES;
	});

	it("normalizes supported Mistral model aliases", () => {
		expect(normalizeModelId("mistral-large")).toBe("mistral-large-latest");
		expect(normalizeModelId("mistral-medium")).toBe(
			"mistral-medium-latest"
		);
		expect(normalizeModelId("pixtral-large")).toBe("mistral-large-latest");
		expect(normalizeModelId("open-mistral-nemo")).toBe("open-mistral-nemo");
	});

	it("selects the Mistral provider for all current supported models", () => {
		const selection = selectModelProvider("codestral", {
			mistral: fakeProvider,
		});

		expect(selection).toMatchObject({
			providerName: "mistral",
			provider: fakeProvider,
			model: "codestral-latest",
			capabilities: {
				supportsText: true,
				supportsImages: false,
				supportsDocumentAttachments: true,
			},
		});
	});

	it("uses current vision capabilities from the shared model catalog", () => {
		expect(
			selectModelProvider("mistral-large", { mistral: fakeProvider })
				?.capabilities.supportsImages
		).toBe(true);
		expect(
			selectModelProvider("ministral-3b", { mistral: fakeProvider })
				?.capabilities.supportsImages
		).toBe(true);
		expect(
			selectModelProvider("codestral", { mistral: fakeProvider })
				?.capabilities.supportsImages
		).toBe(false);
	});

	it("separates function calling from native provider web search", () => {
		const large = selectModelProvider("mistral-large", {
			mistral: fakeProvider,
		})?.capabilities;
		const codestral = selectModelProvider("codestral", {
			mistral: fakeProvider,
		})?.capabilities;

		expect(large?.supportsFunctionCalling).toBe(true);
		expect(large?.supportsNativeWebSearch).toBe(false);
		expect(large?.supportsProviderTools).toBe(false);
		expect(codestral?.supportsFunctionCalling).toBe(false);
	});

	it("rejects unsupported models without selecting a provider", () => {
		expect(
			selectModelProvider("unknown-model", {
				mistral: fakeProvider,
			})
		).toBeNull();
		expect(getSupportedModelAliases()).toContain("mistral-large");
		expect(getSupportedModelAliases()).not.toContain("gpt-5.1");
	});

	it("selects OpenAI only after a controlled rollout override", () => {
		const openaiProvider = {
			complete: vi.fn(),
			stream: vi.fn(),
		};

		expect(
			selectModelProvider("gpt-5.1", { openai: openaiProvider })
		).toBeNull();

		process.env.AI_MODEL_ROLLOUT_OVERRIDES = "gpt-5.1=canary";
		const selection = selectModelProvider("openai:gpt-5.1", {
			openai: openaiProvider,
		});

		expect(selection).toMatchObject({
			providerName: "openai",
			provider: openaiProvider,
			model: "gpt-5.1",
			rolloutState: "canary",
			routePolicyVersion: "ai-gateway-route-v1",
			capabilities: {
				supportsText: true,
				supportsStreaming: true,
				supportsStructuredOutput: true,
			},
		});
		expect(getSupportedModelAliases()).toContain("openai:gpt-5.1");
	});

	it("returns only entitled capability-compatible fallback models", () => {
		const selection = selectModelProvider("mistral-large", {
			mistral: fakeProvider,
		})!;
		const fallbacks = getModelFallbackCandidates({
			model: selection.model,
			tier: "free",
			requiredCapabilities: selection.capabilities,
		});

		expect(fallbacks).toContain("mistral-small-latest");
		expect(fallbacks).toContain("ministral-8b-latest");
		expect(fallbacks).not.toContain("open-mistral-nemo");
	});
});
