import { TavilyWebSearchProvider } from "@/lib/search/providers/tavily-provider";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("TavilyWebSearchProvider", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("posts bounded search parameters and normalizes results", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			Response.json({
				query: "latest model news",
				results: [
					{
						title: "Model News",
						url: "https://example.com/news?utm_source=test&token=secret&page=2#section",
						content: "A concise search result snippet.",
						score: 0.88,
						published_date: "2026-06-12",
					},
					{
						title: "Unsafe URL",
						url: "javascript:alert(1)",
						content: "Should be filtered.",
					},
				],
				response_time: 1.25,
				request_id: "request-1",
				usage: { credits: 1 },
			})
		);

		const provider = new TavilyWebSearchProvider("tvly-test");
		const response = await provider.search({
			query: "latest model news",
			maxResults: 3,
			recencyDays: 7,
			domains: ["example.com"],
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.tavily.com/search",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer tvly-test",
				}),
				body: expect.any(String),
			})
		);
		expect(
			JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
		).toMatchObject({
			query: "latest model news",
			search_depth: "basic",
			max_results: 3,
			time_range: "week",
			include_raw_content: false,
			include_domains: ["example.com"],
		});
		expect(response).toMatchObject({
			provider: "tavily",
			query: "latest model news",
			responseTimeMs: 1250,
			requestId: "request-1",
			results: [
				{
					title: "Model News",
					url: "https://example.com/news?page=2",
					content: "A concise search result snippet.",
					score: 0.88,
					publishedDate: "2026-06-12",
				},
			],
		});
	});

	it("throws on non-2xx Tavily responses", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("rate limited", { status: 429 })
		);

		const provider = new TavilyWebSearchProvider("tvly-test");

		await expect(
			provider.search({ query: "news", maxResults: 2 })
		).rejects.toThrow("Tavily search failed with status 429");
	});

	it("passes abort signals and rejects oversized provider responses", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("{}", {
				headers: { "content-length": "1000001" },
			})
		);
		const controller = new AbortController();
		const provider = new TavilyWebSearchProvider("tvly-test");

		await expect(
			provider.search({ query: "news", maxResults: 2 }, controller.signal)
		).rejects.toThrow("response exceeded the size limit");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ signal: controller.signal })
		);
	});
});
