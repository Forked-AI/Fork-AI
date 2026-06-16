import type { ProviderMessage } from "@/lib/chat-system-prompt";

export interface ModelUsage {
	promptTokens?: number;
	completionTokens?: number;
}

export interface ModelRequest {
	model: string;
	messages: ProviderMessage[];
	signal?: AbortSignal;
	maxTokens?: number;
	temperature?: number;
}

export interface ModelStreamChunk {
	content: string;
	usage?: ModelUsage;
	providerRequestId?: string;
	resolvedModel?: string;
	attempt?: number;
	retryCount?: number;
	fallbackCount?: number;
	requestedModel?: string;
}

export interface ModelCompleteResult {
	content: string;
	usage?: ModelUsage;
	providerRequestId?: string;
	resolvedModel?: string;
}

export interface ModelProvider {
	complete(_request: ModelRequest): Promise<ModelCompleteResult>;
	stream(_request: ModelRequest): Promise<AsyncIterable<ModelStreamChunk>>;
}
