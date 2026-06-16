import {
	RECENT_CHAT_LRU_LIMIT,
	RECENT_CHAT_LRU_STORAGE_KEY,
	addRecentChatToLru,
	recordRecentChatVisit,
	readRecentChatLru,
} from "@/lib/recent-chat-lru";
import { beforeEach, describe, expect, it } from "vitest";

describe("recent chat LRU", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("adds a new active chat to the front", () => {
		expect(addRecentChatToLru(["chat-1"], "chat-2")).toEqual([
			"chat-2",
			"chat-1",
		]);
	});

	it("moves an existing chat to the front", () => {
		expect(
			addRecentChatToLru(["chat-1", "chat-2", "chat-3"], "chat-2")
		).toEqual(["chat-2", "chat-1", "chat-3"]);
	});

	it("limits the list to the configured number of ids", () => {
		const ids = Array.from({ length: 12 }, (_, index) => `chat-${index}`);

		expect(addRecentChatToLru(ids, "chat-new")).toHaveLength(
			RECENT_CHAT_LRU_LIMIT
		);
		expect(addRecentChatToLru(ids, "chat-new")[0]).toBe("chat-new");
	});

	it("ignores empty ids", () => {
		expect(addRecentChatToLru(["chat-1"], "")).toEqual(["chat-1"]);
		expect(addRecentChatToLru(["chat-1"], null)).toEqual(["chat-1"]);
	});

	it("resets malformed stored data safely", () => {
		localStorage.setItem(RECENT_CHAT_LRU_STORAGE_KEY, "{bad json");

		expect(readRecentChatLru()).toEqual([]);
		expect(localStorage.getItem(RECENT_CHAT_LRU_STORAGE_KEY)).toBeNull();
	});

	it("records visits in localStorage", () => {
		recordRecentChatVisit("chat-1");
		recordRecentChatVisit("chat-2");

		expect(readRecentChatLru()).toEqual(["chat-2", "chat-1"]);
	});
});
