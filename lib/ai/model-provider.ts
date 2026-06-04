import type { ProviderMessage } from "@/lib/chat-system-prompt";

export interface ModelUsage {
	promptTokens: number;
	completionTokens: number;
}

export interface ModelRequest {
	model: string;
	messages: ProviderMessage[];
	signal?: AbortSignal;
}

export interface ModelStreamChunk {
	content: string;
	usage?: ModelUsage;
}

export interface ModelCompleteResult {
	content: string;
	usage: ModelUsage;
}

export interface ModelProvider {
	complete(request: ModelRequest): Promise<ModelCompleteResult>;
	stream(request: ModelRequest): Promise<AsyncIterable<ModelStreamChunk>>;
}
