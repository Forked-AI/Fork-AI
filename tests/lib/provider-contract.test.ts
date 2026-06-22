import type { ModelProvider } from "@/lib/ai/model-provider";
import { MistralProvider } from "@/lib/ai/providers/mistral-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { describe, expect, it, vi } from "vitest";

async function collectProvider(provider: ModelProvider, model: string) {
	const complete = await provider.complete({
		model,
		messages: [{ role: "user", content: "Prompt" }],
	});
	const stream = await provider.stream({
		model,
		messages: [{ role: "user", content: "Prompt" }],
	});
	const chunks = [];
	for await (const chunk of stream) chunks.push(chunk);
	return { complete, chunks };
}

async function* mistralStream() {
	yield {
		data: {
			id: "mistral-stream",
			model: "mistral-small-2603",
			choices: [{ delta: { content: "streamed" } }],
			usage: {
				promptTokens: 2,
				completionTokens: 1,
			},
		},
	};
}

function openAiStream() {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({
						type: "response.output_text.delta",
						delta: "streamed",
					})}\n\n`
				)
			);
			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({
						type: "response.completed",
						response: {
							id: "openai-stream",
							model: "gpt-5.1",
							usage: {
								input_tokens: 2,
								output_tokens: 1,
							},
						},
					})}\n\n`
				)
			);
			controller.close();
		},
	});
}

describe("model provider adapter contract", () => {
	it.each([
		[
			"mistral",
			() =>
				new MistralProvider({
					chat: {
						complete: vi.fn(async () => ({
							id: "mistral-complete",
							model: "mistral-small-2603",
							choices: [{ message: { content: "complete" } }],
							usage: {
								promptTokens: 2,
								completionTokens: 1,
							},
						})),
						stream: vi.fn(async () => mistralStream()),
					},
				}),
			"mistral-small-latest",
		],
		[
			"openai",
			() =>
				new OpenAIProvider({
					apiKey: "test-key",
					fetchImpl: vi.fn(async (_url, init) => {
						const body = JSON.parse(String(init?.body));
						if (body.stream) {
							return new Response(openAiStream(), {
								headers: {
									"content-type": "text/event-stream",
								},
							});
						}

						return new Response(
							JSON.stringify({
								id: "openai-complete",
								model: "gpt-5.1",
								output_text: "complete",
								usage: {
									input_tokens: 2,
									output_tokens: 1,
								},
							}),
							{
								headers: {
									"content-type": "application/json",
								},
							}
						);
					}) as unknown as typeof fetch,
				}),
			"gpt-5.1",
		],
	])(
		"%s complete and stream adapters return normalized content, usage, request ids, and resolved models",
		async (_name, createProvider, model) => {
			const { complete, chunks } = await collectProvider(
				createProvider(),
				model
			);

			expect(complete).toMatchObject({
				content: "complete",
				usage: {
					promptTokens: 2,
					completionTokens: 1,
				},
			});
			expect(complete.providerRequestId).toBeTruthy();
			expect(complete.resolvedModel).toBeTruthy();
			expect(chunks.map((chunk) => chunk.content).join("")).toBe(
				"streamed"
			);
			expect(chunks.at(-1)).toMatchObject({
				usage: {
					promptTokens: 2,
					completionTokens: 1,
				},
			});
		}
	);
});
