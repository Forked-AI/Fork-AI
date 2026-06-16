import {
	WebSearchUnavailableError,
	type WebSearchProvider,
	type WebSearchRequest,
} from "@/lib/search/provider";
import { TavilyWebSearchProvider } from "@/lib/search/providers/tavily-provider";

let cachedProvider: WebSearchProvider | null | undefined;

export function getWebSearchProvider() {
	if (cachedProvider !== undefined) {
		return cachedProvider;
	}

	const providerName = process.env.WEB_SEARCH_PROVIDER?.trim() || "tavily";
	if (providerName !== "tavily") {
		cachedProvider = null;
		return cachedProvider;
	}

	const apiKey = process.env.TAVILY_API_KEY?.trim();
	cachedProvider = apiKey ? new TavilyWebSearchProvider(apiKey) : null;
	return cachedProvider;
}

export async function searchWeb(
	request: WebSearchRequest,
	signal?: AbortSignal
) {
	const provider = getWebSearchProvider();
	if (!provider) {
		throw new WebSearchUnavailableError();
	}
	return provider.search(request, signal);
}

export type {
	WebSearchProvider,
	WebSearchRequest,
	WebSearchResponse,
} from "./provider";
