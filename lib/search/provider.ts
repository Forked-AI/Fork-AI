export interface WebSearchRequest {
	query: string;
	maxResults: number;
	recencyDays?: number;
	domains?: string[];
}

export interface WebSearchResult {
	title: string;
	url: string;
	content: string;
	score?: number;
	publishedDate?: string | null;
}

export interface WebSearchResponse {
	provider: string;
	query: string;
	answer?: string | null;
	results: WebSearchResult[];
	responseTimeMs?: number;
	requestId?: string | null;
	usage?: Record<string, unknown>;
}

export interface WebSearchProvider {
	search(
		_request: WebSearchRequest,
		_signal?: AbortSignal
	): Promise<WebSearchResponse>;
}

export class WebSearchUnavailableError extends Error {
	constructor(message = "Web search is not configured") {
		super(message);
		this.name = "WebSearchUnavailableError";
	}
}
