import type { ModelProvider } from "@/lib/ai/model-provider";
import {
	ProviderCircuitOpenError,
	resetProviderCircuitsForTests,
	resilientModelStream,
} from "@/lib/ai/resilience";
import { beforeEach, describe, expect, it, vi } from "vitest";

async function collect(stream: AsyncIterable<{ content: string }>) {
	const chunks = [];
	for await (const chunk of stream) chunks.push(chunk);
	return chunks;
}

describe("resilientModelStream", () => {
	beforeEach(() => {
		resetProviderCircuitsForTests();
	});

	it("retries retryable failures before the first token", async () => {
		const stream = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 429 })
			.mockResolvedValueOnce(
				(async function* () {
					yield { content: "ok" };
				})()
			);
		const provider = { stream } as unknown as ModelProvider;
		const attempts = vi.fn();

		const chunks = await collect(
			resilientModelStream({
				providerName: "mistral",
				provider,
				primaryModel: "mistral-large-latest",
				request: { messages: [{ role: "user", content: "prompt" }] },
				baseDelayMs: 0,
				maxDelayMs: 0,
				onAttempt: attempts,
			})
		);

		expect(stream).toHaveBeenCalledTimes(2);
		expect(chunks[0]).toMatchObject({
			content: "ok",
			retryCount: 1,
			fallbackCount: 0,
		});
		expect(attempts).toHaveBeenCalledWith(
			expect.objectContaining({ status: "retrying", retryCount: 1 })
		);
	});

	it("falls back after exhausting the primary model", async () => {
		const stream = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 503 })
			.mockResolvedValueOnce(
				(async function* () {
					yield { content: "fallback" };
				})()
			);
		const provider = { stream } as unknown as ModelProvider;

		const chunks = await collect(
			resilientModelStream({
				providerName: "mistral",
				provider,
				primaryModel: "mistral-large-latest",
				fallbackModels: ["mistral-small-latest"],
				request: { messages: [{ role: "user", content: "prompt" }] },
				maxAttemptsPerModel: 1,
			})
		);

		expect(stream.mock.calls.map(([request]) => request.model)).toEqual([
			"mistral-large-latest",
			"mistral-small-latest",
		]);
		expect(chunks[0]).toMatchObject({
			content: "fallback",
			fallbackCount: 1,
		});
	});

	it("does not retry after partial output", async () => {
		const provider = {
			stream: vi.fn(async () =>
				(async function* () {
					yield { content: "partial" };
					throw { statusCode: 503 };
				})()
			),
		} as unknown as ModelProvider;

		await expect(
			collect(
				resilientModelStream({
					providerName: "mistral",
					provider,
					primaryModel: "mistral-large-latest",
					fallbackModels: ["mistral-small-latest"],
					request: {
						messages: [{ role: "user", content: "prompt" }],
					},
				})
			)
		).rejects.toMatchObject({ statusCode: 503 });
		expect(provider.stream).toHaveBeenCalledTimes(1);
	});

	it("opens the model circuit after repeated retryable failures", async () => {
		const provider = {
			stream: vi.fn().mockRejectedValue({ statusCode: 503 }),
		} as unknown as ModelProvider;

		await expect(
			collect(
				resilientModelStream({
					providerName: "mistral",
					provider,
					primaryModel: "mistral-large-latest",
					request: {
						messages: [{ role: "user", content: "prompt" }],
					},
					maxAttemptsPerModel: 1,
					failureThreshold: 1,
					openMs: 30_000,
					now: () => 1_000,
				})
			)
		).rejects.toMatchObject({ statusCode: 503 });

		await expect(
			collect(
				resilientModelStream({
					providerName: "mistral",
					provider,
					primaryModel: "mistral-large-latest",
					request: {
						messages: [{ role: "user", content: "prompt" }],
					},
					maxAttemptsPerModel: 1,
					failureThreshold: 1,
					openMs: 30_000,
					now: () => 1_000,
				})
			)
		).rejects.toBeInstanceOf(ProviderCircuitOpenError);
		expect(provider.stream).toHaveBeenCalledTimes(1);
	});
});
