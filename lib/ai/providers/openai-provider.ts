import type {
	ModelCompleteResult,
	ModelProvider,
	ModelRequest,
	ModelStreamChunk,
	ModelUsage,
} from "@/lib/ai/model-provider";
import type {
	ProviderContentPart,
	ProviderMessage,
	ProviderMessageContent,
} from "@/lib/chat-system-prompt";

interface OpenAIResponsesUsage {
	input_tokens?: number;
	output_tokens?: number;
}

interface OpenAIResponsesOutputContent {
	type?: string;
	text?: string;
}

interface OpenAIResponsesOutput {
	type?: string;
	role?: string;
	content?: OpenAIResponsesOutputContent[];
}

interface OpenAIResponsesResult {
	id?: string;
	model?: string;
	output_text?: string;
	output?: OpenAIResponsesOutput[];
	usage?: OpenAIResponsesUsage;
}

interface OpenAIErrorLike extends Error {
	status?: number;
	statusCode?: number;
	headers?: Headers;
	rawResponse?: {
		status?: number;
		headers?: Headers;
	};
}

type OpenAIFetch = typeof fetch;

function toUsage(
	usage: OpenAIResponsesUsage | undefined
): ModelUsage | undefined {
	if (
		!usage ||
		(usage.input_tokens === undefined && usage.output_tokens === undefined)
	) {
		return undefined;
	}

	return {
		promptTokens: usage.input_tokens,
		completionTokens: usage.output_tokens,
	};
}

function extractOutputText(response: OpenAIResponsesResult): string {
	if (typeof response.output_text === "string") {
		return response.output_text;
	}

	return (
		response.output
			?.flatMap((item) => item.content ?? [])
			.filter((part) => part.type === "output_text")
			.map((part) => part.text ?? "")
			.join("") ?? ""
	);
}

function toOpenAIContent(content: ProviderMessageContent) {
	if (typeof content === "string") {
		return content;
	}

	return content.map((part) => toOpenAIContentPart(part));
}

function toOpenAIContentPart(part: ProviderContentPart) {
	if (part.type === "text") {
		return {
			type: "input_text",
			text: part.text,
		};
	}

	const imageUrl =
		typeof part.imageUrl === "string" ? part.imageUrl : part.imageUrl.url;

	return {
		type: "input_image",
		image_url: imageUrl,
	};
}

function toOpenAIInput(messages: ProviderMessage[]) {
	return messages.map((message) => ({
		role: message.role,
		content: toOpenAIContent(message.content),
	}));
}

function buildOpenAIError(response: Response, body: string): OpenAIErrorLike {
	const error = new Error(
		body.trim() || `OpenAI request failed with status ${response.status}`
	) as OpenAIErrorLike;
	error.status = response.status;
	error.statusCode = response.status;
	error.headers = response.headers;
	error.rawResponse = {
		status: response.status,
		headers: response.headers,
	};
	return error;
}

function buildRequestBody(request: ModelRequest, stream: boolean) {
	return {
		model: request.model,
		input: toOpenAIInput(request.messages),
		store: false,
		stream,
		...(request.maxTokens !== undefined
			? { max_output_tokens: request.maxTokens }
			: {}),
		...(request.temperature !== undefined
			? { temperature: request.temperature }
			: {}),
	};
}

export class OpenAIProvider implements ModelProvider {
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly fetchImpl: OpenAIFetch;

	constructor({
		apiKey = process.env.OPENAI_API_KEY ?? "",
		baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
		fetchImpl = fetch,
	}: {
		apiKey?: string;
		baseUrl?: string;
		fetchImpl?: OpenAIFetch;
	} = {}) {
		this.apiKey = apiKey.trim();
		this.baseUrl = baseUrl.replace(/\/+$/, "");
		this.fetchImpl = fetchImpl;
	}

	async complete(request: ModelRequest): Promise<ModelCompleteResult> {
		const response = await this.requestResponsesApi(request, false);
		const body = (await response.json()) as OpenAIResponsesResult;

		return {
			content: extractOutputText(body),
			usage: toUsage(body.usage),
			providerRequestId:
				body.id ?? response.headers.get("x-request-id") ?? undefined,
			resolvedModel: body.model,
		};
	}

	async stream(
		request: ModelRequest
	): Promise<AsyncIterable<ModelStreamChunk>> {
		const response = await this.requestResponsesApi(request, true);
		const body = response.body;
		if (!body) {
			throw buildOpenAIError(
				response,
				"OpenAI stream response was empty"
			);
		}

		return this.mapEventStream(body);
	}

	private async requestResponsesApi(request: ModelRequest, stream: boolean) {
		if (!this.apiKey) {
			throw Object.assign(new Error("OPENAI_API_KEY is not configured"), {
				statusCode: 401,
			});
		}

		const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${this.apiKey}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(buildRequestBody(request, stream)),
			signal: request.signal,
		});

		if (!response.ok) {
			throw buildOpenAIError(response, await response.text());
		}

		return response;
	}

	private async *mapEventStream(
		stream: ReadableStream<Uint8Array>
	): AsyncIterable<ModelStreamChunk> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let providerRequestId: string | undefined;
		let resolvedModel: string | undefined;
		let usage: ModelUsage | undefined;

		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const events = buffer.split(/\n\n/);
				buffer = events.pop() ?? "";

				for (const event of events) {
					const chunk = this.mapServerSentEvent(event);
					if (!chunk) continue;
					providerRequestId =
						chunk.providerRequestId ?? providerRequestId;
					resolvedModel = chunk.resolvedModel ?? resolvedModel;
					usage = chunk.usage ?? usage;
					yield {
						...chunk,
						providerRequestId,
						resolvedModel,
						usage: chunk.usage,
					};
				}
			}

			if (buffer.trim()) {
				const chunk = this.mapServerSentEvent(buffer);
				if (chunk) {
					yield {
						...chunk,
						providerRequestId:
							chunk.providerRequestId ?? providerRequestId,
						resolvedModel: chunk.resolvedModel ?? resolvedModel,
						usage: chunk.usage ?? usage,
					};
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	private mapServerSentEvent(event: string): ModelStreamChunk | null {
		const dataLines = event
			.split(/\r?\n/)
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice("data:".length).trim());
		if (dataLines.length === 0) return null;

		const data = dataLines.join("\n");
		if (!data || data === "[DONE]") return null;

		const parsed = JSON.parse(data) as {
			type?: string;
			response?: OpenAIResponsesResult;
			item?: OpenAIResponsesOutput;
			delta?: string;
		};

		if (parsed.type === "response.output_text.delta") {
			return {
				content: parsed.delta ?? "",
			};
		}

		if (parsed.type === "response.completed" && parsed.response) {
			return {
				content: "",
				usage: toUsage(parsed.response.usage),
				providerRequestId: parsed.response.id,
				resolvedModel: parsed.response.model,
			};
		}

		if (parsed.type === "response.output_item.done" && parsed.item) {
			return {
				content:
					parsed.item.content
						?.filter((part) => part.type === "output_text")
						.map((part) => part.text ?? "")
						.join("") ?? "",
			};
		}

		return null;
	}
}
