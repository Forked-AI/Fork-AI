import { MistralProvider } from "@/lib/ai/providers/mistral-provider";
import { describe, expect, it, vi } from "vitest";

async function* createProviderStream() {
	yield {
		data: {
			id: "completion-1",
			model: "mistral-large-2512",
			choices: [{ delta: { content: "Hello" } }],
		},
	};
	yield {
		data: {
			id: "completion-1",
			model: "mistral-large-2512",
			choices: [{ delta: {} }],
			usage: {
				promptTokens: 7,
				completionTokens: 3,
			},
		},
	};
}

describe("MistralProvider", () => {
	it("maps Mistral stream events to provider stream chunks", async () => {
		const client = {
			chat: {
				complete: vi.fn(),
				stream: vi.fn(async () => createProviderStream()),
			},
		};
		const provider = new MistralProvider(client);
		const stream = await provider.stream({
			model: "mistral-large-latest",
			messages: [{ role: "user", content: "Prompt" }],
		});
		const chunks = [];

		for await (const chunk of stream) {
			chunks.push(chunk);
		}

		expect(client.chat.stream).toHaveBeenCalledWith({
			model: "mistral-large-latest",
			messages: [{ role: "user", content: "Prompt" }],
		});
		expect(chunks[0]).toMatchObject({
			content: "Hello",
			providerRequestId: "completion-1",
			resolvedModel: "mistral-large-2512",
		});
		expect(chunks[0].usage).toBeUndefined();
		expect(chunks[1]).toEqual({
			content: "",
			usage: {
				promptTokens: 7,
				completionTokens: 3,
			},
			providerRequestId: "completion-1",
			resolvedModel: "mistral-large-2512",
		});
	});

	it("passes AbortSignal through stream request options", async () => {
		const client = {
			chat: {
				complete: vi.fn(),
				stream: vi.fn(async () => createProviderStream()),
			},
		};
		const provider = new MistralProvider(client);
		const controller = new AbortController();

		await provider.stream({
			model: "mistral-large-latest",
			messages: [{ role: "user", content: "Prompt" }],
			signal: controller.signal,
		});

		expect(client.chat.stream).toHaveBeenCalledWith(
			{
				model: "mistral-large-latest",
				messages: [{ role: "user", content: "Prompt" }],
			},
			{ signal: controller.signal }
		);
	});

	it("passes vision content parts through stream requests", async () => {
		const client = {
			chat: {
				complete: vi.fn(),
				stream: vi.fn(async () => createProviderStream()),
			},
		};
		const provider = new MistralProvider(client);

		await provider.stream({
			model: "pixtral-large-latest",
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: "Describe this" },
						{
							type: "image_url",
							imageUrl: "data:image/png;base64,abc=",
						},
					],
				},
			],
		});

		expect(client.chat.stream).toHaveBeenCalledWith({
			model: "pixtral-large-latest",
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: "Describe this" },
						{
							type: "image_url",
							imageUrl: "data:image/png;base64,abc=",
						},
					],
				},
			],
		});
	});

	it("extracts text from array-shaped complete responses", async () => {
		const client = {
			chat: {
				complete: vi.fn(async () => ({
					id: "completion-vision",
					model: "pixtral-large-2512",
					choices: [
						{
							message: {
								content: [
									{ type: "text", text: "The image shows " },
									{ type: "text", text: "a chart." },
								],
							},
						},
					],
				})),
				stream: vi.fn(),
			},
		};
		const provider = new MistralProvider(client);

		await expect(
			provider.complete({
				model: "pixtral-large-latest",
				messages: [{ role: "user", content: "Prompt" }],
			})
		).resolves.toMatchObject({
			content: "The image shows a chart.",
			providerRequestId: "completion-vision",
			resolvedModel: "pixtral-large-2512",
		});
	});

	it("maps complete responses to text and usage", async () => {
		const client = {
			chat: {
				complete: vi.fn(async () => ({
					id: "completion-2",
					model: "mistral-small-2603",
					choices: [{ message: { content: "Done" } }],
					usage: {
						promptTokens: 5,
						completionTokens: 2,
					},
				})),
				stream: vi.fn(),
			},
		};
		const provider = new MistralProvider(client);

		await expect(
			provider.complete({
				model: "mistral-large-latest",
				messages: [{ role: "user", content: "Prompt" }],
			})
		).resolves.toEqual({
			content: "Done",
			usage: {
				promptTokens: 5,
				completionTokens: 2,
			},
			providerRequestId: "completion-2",
			resolvedModel: "mistral-small-2603",
		});
	});

	it("preserves missing provider usage instead of reporting zero tokens", async () => {
		const client = {
			chat: {
				complete: vi.fn(async () => ({
					id: "completion-3",
					model: "mistral-small-2603",
					choices: [{ message: { content: "Done" } }],
				})),
				stream: vi.fn(),
			},
		};
		const provider = new MistralProvider(client);

		await expect(
			provider.complete({
				model: "mistral-small-latest",
				messages: [{ role: "user", content: "Prompt" }],
			})
		).resolves.toEqual({
			content: "Done",
			usage: undefined,
			providerRequestId: "completion-3",
			resolvedModel: "mistral-small-2603",
		});
	});
});
