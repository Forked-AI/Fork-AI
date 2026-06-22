import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { describe, expect, it } from "vitest";

const runLive =
	process.env.RUN_LIVE_OPENAI_PROVIDER_TEST === "1" &&
	Boolean(process.env.OPENAI_API_KEY?.trim());

describe("OpenAIProvider live smoke", () => {
	it.skipIf(!runLive)(
		"completes a minimal Responses request when explicitly enabled",
		async () => {
			const provider = new OpenAIProvider();

			const response = await provider.complete({
				model: process.env.OPENAI_LIVE_SMOKE_MODEL ?? "gpt-5.1",
				messages: [
					{
						role: "user",
						content: "Reply with exactly: fork-ai-live-smoke",
					},
				],
				maxTokens: 16,
				temperature: 0,
			});

			expect(response.content.toLowerCase()).toContain(
				"fork-ai-live-smoke"
			);
			expect(response.providerRequestId).toBeTruthy();
		}
	);
});
