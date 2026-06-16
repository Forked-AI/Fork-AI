import type {
	WebSearchProvider,
	WebSearchRequest,
	WebSearchResponse,
	WebSearchResult,
} from "@/lib/search/provider";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const MAX_TAVILY_RESPONSE_BYTES = 1_000_000;

interface TavilySearchResult {
	title?: unknown;
	url?: unknown;
	content?: unknown;
	score?: unknown;
	published_date?: unknown;
}

interface TavilySearchResponse {
	query?: unknown;
	answer?: unknown;
	results?: unknown;
	response_time?: unknown;
	request_id?: unknown;
	usage?: unknown;
}

function toTimeRange(recencyDays: number | undefined) {
	if (!recencyDays) return undefined;
	if (recencyDays <= 1) return "day";
	if (recencyDays <= 7) return "week";
	if (recencyDays <= 31) return "month";
	return "year";
}

function parseHttpUrl(value: unknown) {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		if (url.username || url.password) return null;
		url.hash = "";
		for (const key of [...url.searchParams.keys()]) {
			if (
				/^utm_/i.test(key) ||
				/(auth|credential|key|password|secret|signature|token)/i.test(
					key
				)
			) {
				url.searchParams.delete(key);
			}
		}
		return url.toString();
	} catch {
		return null;
	}
}

function parseResult(result: TavilySearchResult): WebSearchResult | null {
	const url = parseHttpUrl(result.url);
	if (!url) return null;

	return {
		title:
			typeof result.title === "string" && result.title.trim()
				? result.title.trim()
				: url,
		url,
		content:
			typeof result.content === "string" ? result.content.trim() : "",
		score: typeof result.score === "number" ? result.score : undefined,
		publishedDate:
			typeof result.published_date === "string"
				? result.published_date
				: null,
	};
}

function isWebSearchResult(
	result: WebSearchResult | null
): result is WebSearchResult {
	return Boolean(result);
}

export class TavilyWebSearchProvider implements WebSearchProvider {
	private readonly apiKeyValue: string;

	constructor(apiKey: string) {
		this.apiKeyValue = apiKey;
	}

	async search(
		request: WebSearchRequest,
		signal?: AbortSignal
	): Promise<WebSearchResponse> {
		const startedAt = Date.now();
		const response = await fetch(TAVILY_SEARCH_URL, {
			method: "POST",
			signal,
			headers: {
				Authorization: `Bearer ${this.apiKeyValue}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: request.query,
				search_depth: "basic",
				max_results: request.maxResults,
				topic: "general",
				time_range: toTimeRange(request.recencyDays),
				include_answer: false,
				include_raw_content: false,
				include_images: false,
				include_favicon: false,
				include_usage: true,
				include_domains: request.domains,
			}),
		});

		if (!response.ok) {
			throw new Error(
				`Tavily search failed with status ${response.status}`
			);
		}

		const contentLength = Number(response.headers.get("content-length"));
		if (
			Number.isFinite(contentLength) &&
			contentLength > MAX_TAVILY_RESPONSE_BYTES
		) {
			throw new Error("Tavily search response exceeded the size limit");
		}

		const responseText = await response.text();
		if (
			Buffer.byteLength(responseText, "utf8") > MAX_TAVILY_RESPONSE_BYTES
		) {
			throw new Error("Tavily search response exceeded the size limit");
		}

		let payload: TavilySearchResponse;
		try {
			payload = JSON.parse(responseText) as TavilySearchResponse;
		} catch {
			throw new Error("Tavily search returned invalid JSON");
		}
		const rawResults = Array.isArray(payload.results)
			? (payload.results as TavilySearchResult[])
			: [];
		const results = rawResults.map(parseResult).filter(isWebSearchResult);

		return {
			provider: "tavily",
			query:
				typeof payload.query === "string" && payload.query.trim()
					? payload.query
					: request.query,
			answer: typeof payload.answer === "string" ? payload.answer : null,
			results,
			responseTimeMs:
				typeof payload.response_time === "number"
					? Math.round(payload.response_time * 1000)
					: Date.now() - startedAt,
			requestId:
				typeof payload.request_id === "string"
					? payload.request_id
					: null,
			usage:
				payload.usage &&
				typeof payload.usage === "object" &&
				!Array.isArray(payload.usage)
					? (payload.usage as Record<string, unknown>)
					: undefined,
		};
	}
}
