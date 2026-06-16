import type {
	ModelCompleteResult,
	ModelProvider,
	ModelRequest,
	ModelStreamChunk,
} from "@/lib/ai/model-provider";
import type {
	ProviderContentPart,
	ProviderMessage,
	ProviderMessageContent,
} from "@/lib/chat-system-prompt";
import { mistralClient } from "@/lib/models";

interface MistralUsageLike {
	promptTokens?: number;
	completionTokens?: number;
}

interface MistralStreamEventLike {
	data?: {
		id?: string;
		model?: string;
		choices?: Array<{
			delta?: {
				content?: ProviderMessageContent | null;
			};
		}>;
		usage?: MistralUsageLike;
	};
}

interface MistralCompleteResponseLike {
	id?: string;
	model?: string;
	choices?: Array<{
		message?: {
			content?: unknown;
		};
	}>;
	usage?: MistralUsageLike;
}

interface MistralClientLike {
	chat: {
		complete(
			_request: {
				model: string;
				messages: ProviderMessage[];
				maxTokens?: number;
				temperature?: number;
			},
			_options?: { signal?: AbortSignal }
		): Promise<MistralCompleteResponseLike>;
		stream(
			_request: {
				model: string;
				messages: ProviderMessage[];
				maxTokens?: number;
				temperature?: number;
			},
			_options?: { signal?: AbortSignal }
		): Promise<AsyncIterable<MistralStreamEventLike>>;
	};
}

function toUsage(usage: MistralUsageLike | undefined) {
	if (
		!usage ||
		(usage.promptTokens === undefined &&
			usage.completionTokens === undefined)
	) {
		return undefined;
	}

	return {
		promptTokens: usage.promptTokens,
		completionTokens: usage.completionTokens,
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

function toMistralMessages(messages: ProviderMessage[]): ProviderMessage[] {
	return messages.map((message) => ({
		...message,
		content: Array.isArray(message.content)
			? message.content.map((part): ProviderContentPart => {
					if (part.type === "image_url") {
						return {
							type: "image_url",
							imageUrl: part.imageUrl,
						};
					}

					return part;
				})
			: message.content,
	}));
}

export class MistralProvider implements ModelProvider {
	private readonly client: MistralClientLike;

	constructor(
		client: MistralClientLike = mistralClient as unknown as MistralClientLike
	) {
		this.client = client;
	}

	async complete(request: ModelRequest): Promise<ModelCompleteResult> {
		const providerRequest = {
			model: request.model,
			messages: toMistralMessages(request.messages),
			...(request.maxTokens !== undefined
				? { maxTokens: request.maxTokens }
				: {}),
			...(request.temperature !== undefined
				? { temperature: request.temperature }
				: {}),
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
			usage: toUsage(response.usage),
			providerRequestId: response.id,
			resolvedModel: response.model,
		};
	}

	async stream(
		request: ModelRequest
	): Promise<AsyncIterable<ModelStreamChunk>> {
		const providerRequest = {
			model: request.model,
			messages: toMistralMessages(request.messages),
			...(request.maxTokens !== undefined
				? { maxTokens: request.maxTokens }
				: {}),
			...(request.temperature !== undefined
				? { temperature: request.temperature }
				: {}),
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
				content: extractTextContent(
					event.data?.choices?.[0]?.delta?.content ?? ""
				),
				usage: toUsage(event.data?.usage),
				providerRequestId: event.data?.id,
				resolvedModel: event.data?.model,
			};
		}
	}
}
