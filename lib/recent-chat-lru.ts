export const RECENT_CHAT_LRU_STORAGE_KEY = "fork-ai-recent-chat-lru";
export const RECENT_CHAT_LRU_LIMIT = 5;

function isValidConversationId(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

export function normalizeRecentChatLru(
	value: unknown,
	limit = RECENT_CHAT_LRU_LIMIT
) {
	if (!Array.isArray(value)) {
		return [];
	}

	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const item of value) {
		if (!isValidConversationId(item)) {
			continue;
		}

		const id = item.trim();
		if (seen.has(id)) {
			continue;
		}

		seen.add(id);
		normalized.push(id);

		if (normalized.length >= limit) {
			break;
		}
	}

	return normalized;
}

export function addRecentChatToLru(
	currentIds: unknown,
	conversationId: string | null | undefined,
	limit = RECENT_CHAT_LRU_LIMIT
) {
	if (!isValidConversationId(conversationId)) {
		return normalizeRecentChatLru(currentIds, limit);
	}

	const id = conversationId.trim();
	return normalizeRecentChatLru(
		[id, ...normalizeRecentChatLru(currentIds, limit)],
		limit
	);
}

export function readRecentChatLru(storage: Storage = window.localStorage) {
	try {
		const stored = storage.getItem(RECENT_CHAT_LRU_STORAGE_KEY);
		if (!stored) {
			return [];
		}

		return normalizeRecentChatLru(JSON.parse(stored));
	} catch {
		storage.removeItem(RECENT_CHAT_LRU_STORAGE_KEY);
		return [];
	}
}

export function writeRecentChatLru(
	ids: string[],
	storage: Storage = window.localStorage
) {
	const normalized = normalizeRecentChatLru(ids);
	storage.setItem(RECENT_CHAT_LRU_STORAGE_KEY, JSON.stringify(normalized));
	return normalized;
}

export function recordRecentChatVisit(
	conversationId: string | null | undefined,
	storage: Storage = window.localStorage
) {
	const nextIds = addRecentChatToLru(
		readRecentChatLru(storage),
		conversationId
	);
	writeRecentChatLru(nextIds, storage);
	return nextIds;
}
