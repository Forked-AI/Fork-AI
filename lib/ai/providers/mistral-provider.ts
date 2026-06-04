import type {
	ModelCompleteResult,
	ModelProvider,
	ModelRequest,
	ModelStreamChunk,
} from "@/lib/ai/model-provider";
import type { ProviderMessage } from "@/lib/chat-system-prompt";
import { mistralClient } from "@/lib/models";

interface MistralUsageLike {
	promptTokens?: number;
	completionTokens?: number;
}

interface MistralStreamEventLike {
	data?: {
		choices?: Array<{
			delta?: {
				content?: string;
			};
		}>;
		usage?: MistralUsageLike;
	};
}

interface MistralCompleteResponseLike {
	choices?: Array<{
		message?: {
			content?: unknown;
		};
	}>;
	usage?: MistralUsageLike;
}

interface MistralClientLike {
	chat: {
		complete(request: {
			model: string;
			messages: ProviderMessage[];
		}, options?: { signal?: AbortSignal }): Promise<MistralCompleteResponseLike>;
		stream(request: {
			model: string;
			messages: ProviderMessage[];
		}, options?: { signal?: AbortSignal }): Promise<AsyncIterable<MistralStreamEventLike>>;
	};
}

function toUsage(usage: MistralUsageLike | undefined) {
	if (!usage) {
		return undefined;
	}

	return {
		promptTokens: usage.promptTokens ?? 0,
		completionTokens: usage.completionTokens ?? 0,
	};
}

function extractTextContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") {
					return part;
				}

				if (
					part &&
					typeof part === "object" &&
					"text" in part &&
					typeof (part as { text?: unknown }).text === "string"
				) {
					return (part as { text: string }).text;
				}

				return "";
			})
			.join("");
	}

	return "";
}

export class MistralProvider implements ModelProvider {
	constructor(
		private readonly client: MistralClientLike = mistralClient as unknown as MistralClientLike
	) {}

	async complete(request: ModelRequest): Promise<ModelCompleteResult> {
		const providerRequest = {
			model: request.model,
			messages: request.messages,
		};
		const response = request.signal
			? await this.client.chat.complete(providerRequest, {
					signal: request.signal,
				})
			: await this.client.chat.complete(providerRequest);

		return {
			content: extractTextContent(
				response.choices?.[0]?.message?.content
			),
			usage: toUsage(response.usage) ?? {
				promptTokens: 0,
				completionTokens: 0,
			},
		};
	}

	async stream(
		request: ModelRequest
	): Promise<AsyncIterable<ModelStreamChunk>> {
		const providerRequest = {
			model: request.model,
			messages: request.messages,
		};
		const providerStream = request.signal
			? await this.client.chat.stream(providerRequest, {
					signal: request.signal,
				})
			: await this.client.chat.stream(providerRequest);

		return this.mapStream(providerStream);
	}

	private async *mapStream(
		providerStream: AsyncIterable<MistralStreamEventLike>
	): AsyncIterable<ModelStreamChunk> {
		for await (const event of providerStream) {
			yield {
				content: event.data?.choices?.[0]?.delta?.content ?? "",
				usage: toUsage(event.data?.usage),
			};
		}
	}
}
