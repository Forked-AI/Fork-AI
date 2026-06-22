import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { describe, expect, it, vi } from "vitest";

function createFetchResponse(body: BodyInit, init: ResponseInit = {}) {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "application/json", ...init.headers },
		...init,
	});
}

function createEventStream(events: unknown[]) {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const event of events) {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
				);
			}
			controller.close();
		},
	});
}

describe("OpenAIProvider", () => {
	it("maps Responses complete output, usage, and request body", async () => {
		const fetchImpl = vi.fn(async () =>
			createFetchResponse(
				JSON.stringify({
					id: "resp_123",
					model: "gpt-5.1",
					output_text: "Done",
					usage: {
						input_tokens: 9,
						output_tokens: 4,
					},
				})
			)
		) as unknown as typeof fetch;
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			fetchImpl,
		});

		await expect(
			provider.complete({
				model: "gpt-5.1",
				messages: [
					{ role: "system", content: "Be concise." },
					{ role: "user", content: "Say done" },
				],
				maxTokens: 64,
				temperature: 0,
			})
		).resolves.toEqual({
			content: "Done",
			usage: {
				promptTokens: 9,
				completionTokens: 4,
			},
			providerRequestId: "resp_123",
			resolvedModel: "gpt-5.1",
		});

		expect(fetchImpl).toHaveBeenCalledWith(
			"https://api.openai.com/v1/responses",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					authorization: "Bearer test-key",
				}),
				body: JSON.stringify({
					model: "gpt-5.1",
					input: [
						{ role: "system", content: "Be concise." },
						{ role: "user", content: "Say done" },
					],
					store: false,
					stream: false,
					max_output_tokens: 64,
					temperature: 0,
				}),
			})
		);
	});

	it("maps Responses streaming deltas and final usage", async () => {
		const stream = createEventStream([
			{ type: "response.output_text.delta", delta: "Hel" },
			{ type: "response.output_text.delta", delta: "lo" },
			{
				type: "response.completed",
				response: {
					id: "resp_stream",
					model: "gpt-5.1",
					usage: {
						input_tokens: 3,
						output_tokens: 2,
					},
				},
			},
		]);
		const fetchImpl = vi.fn(async () =>
			createFetchResponse(stream, {
				headers: { "content-type": "text/event-stream" },
			})
		) as unknown as typeof fetch;
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			fetchImpl,
		});

		const chunks = [];
		const responseStream = await provider.stream({
			model: "gpt-5.1",
			messages: [{ role: "user", content: "Hello" }],
		});
		for await (const chunk of responseStream) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual([
			{
				content: "Hel",
				providerRequestId: undefined,
				resolvedModel: undefined,
				usage: undefined,
			},
			{
				content: "lo",
				providerRequestId: undefined,
				resolvedModel: undefined,
				usage: undefined,
			},
			{
				content: "",
				providerRequestId: "resp_stream",
				resolvedModel: "gpt-5.1",
				usage: {
					promptTokens: 3,
					completionTokens: 2,
				},
			},
		]);
	});

	it("normalizes HTTP failures with status and provider headers", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response("rate limited", {
					status: 429,
					headers: {
						"x-request-id": "req_429",
						"retry-after": "3",
					},
				})
		) as unknown as typeof fetch;
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			fetchImpl,
		});

		await expect(
			provider.complete({
				model: "gpt-5.1",
				messages: [{ role: "user", content: "Hello" }],
			})
		).rejects.toMatchObject({
			statusCode: 429,
			headers: expect.any(Headers),
		});
	});
});
