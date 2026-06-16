import {
	clearCachedConversationDetail,
	clearConversationDetailCache,
	fetchConversationDetail,
} from "@/lib/conversation-api";
import { afterEach, describe, expect, it, vi } from "vitest";

function createConversationResponse(conversationId: string) {
	return new Response(
		JSON.stringify({
			conversation: {
				id: conversationId,
				title: "Test conversation",
				messages: [],
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		}
	);
}

function createDeferredResponse() {
	let resolve!: (_response: Response) => void;

	const promise = new Promise<Response>((res) => {
		resolve = res;
	});

	return { promise, resolve };
}

describe("fetchConversationDetail", () => {
	afterEach(() => {
		clearConversationDetailCache();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("returns cached detail without refetching the same conversation id", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				createConversationResponse("conversation-cache")
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			fetchConversationDetail("conversation-cache")
		).resolves.toMatchObject({
			id: "conversation-cache",
		});
		await expect(
			fetchConversationDetail("conversation-cache")
		).resolves.toMatchObject({
			id: "conversation-cache",
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("deduplicates in-flight requests for the same conversation id", async () => {
		const deferred = createDeferredResponse();
		const fetchMock = vi.fn().mockImplementation(() => deferred.promise);
		vi.stubGlobal("fetch", fetchMock);

		const requestA = fetchConversationDetail("conversation-1");
		const requestB = fetchConversationDetail("conversation-1");

		expect(fetchMock).toHaveBeenCalledTimes(1);

		deferred.resolve(createConversationResponse("conversation-1"));

		await expect(requestA).resolves.toMatchObject({ id: "conversation-1" });
		await expect(requestB).resolves.toMatchObject({ id: "conversation-1" });
	});

	it("clears the in-flight slot after failure so a retry can refetch", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "failed" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				})
			)
			.mockResolvedValueOnce(
				createConversationResponse("conversation-2")
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchConversationDetail("conversation-2")).rejects.toThrow(
			"failed"
		);
		await expect(
			fetchConversationDetail("conversation-2")
		).resolves.toMatchObject({
			id: "conversation-2",
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("evicts the oldest completed cache entries after the cache limit", async () => {
		const fetchMock = vi.fn((input: string) => {
			const conversationId = input.split("/").at(-1) ?? "unknown";
			return Promise.resolve(createConversationResponse(conversationId));
		});
		vi.stubGlobal("fetch", fetchMock);

		for (let index = 0; index < 11; index += 1) {
			await fetchConversationDetail(`conversation-${index}`);
		}

		await fetchConversationDetail("conversation-0");
		await fetchConversationDetail("conversation-10");

		expect(fetchMock).toHaveBeenCalledTimes(12);
		expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
			"/api/conversations/conversation-0"
		);
	});

	it("allows a cached conversation to be cleared explicitly", async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation(() =>
				createConversationResponse("conversation-clear")
			);
		vi.stubGlobal("fetch", fetchMock);

		await fetchConversationDetail("conversation-clear");
		clearCachedConversationDetail("conversation-clear");
		await fetchConversationDetail("conversation-clear");

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
