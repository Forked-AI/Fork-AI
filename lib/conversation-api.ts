export const conversationDetailQueryKey = (conversationId: string | null) =>
	["conversation", conversationId] as const;

interface ConversationMessagePayload {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	model?: string | null;
	promptTokens?: number | null;
	completionTokens?: number | null;
	isError?: boolean | null;
	status?:
		| "pending"
		| "streaming"
		| "completed"
		| "failed"
		| "cancelled"
		| "moderated"
		| null;
	errorCode?: string | null;
	providerStatusCode?: number | null;
	providerRequestId?: string | null;
	startedAt?: string | Date | null;
	completedAt?: string | Date | null;
	cancelledAt?: string | Date | null;
	lastChunkAt?: string | Date | null;
	createdAt?: string | Date;
	parentMessageId?: string | null;
}

export interface ConversationDetailPayload {
	id: string;
	title: string;
	messages: ConversationMessagePayload[];
}

const CONVERSATION_DETAIL_CACHE_LIMIT = 10;

const inFlightConversationRequests = new Map<
	string,
	Promise<ConversationDetailPayload>
>();
const conversationDetailCache = new Map<string, ConversationDetailPayload>();

export function cacheConversationDetail(
	conversation: ConversationDetailPayload
) {
	conversationDetailCache.delete(conversation.id);
	conversationDetailCache.set(conversation.id, conversation);

	while (conversationDetailCache.size > CONVERSATION_DETAIL_CACHE_LIMIT) {
		const oldestConversationId = conversationDetailCache
			.keys()
			.next().value;
		if (!oldestConversationId) break;
		conversationDetailCache.delete(oldestConversationId);
	}

	return conversation;
}

export function getCachedConversationDetail(conversationId: string) {
	const conversation = conversationDetailCache.get(conversationId);
	if (!conversation) {
		return null;
	}

	conversationDetailCache.delete(conversationId);
	conversationDetailCache.set(conversationId, conversation);
	return conversation;
}

export function clearCachedConversationDetail(conversationId: string) {
	conversationDetailCache.delete(conversationId);
}

export function clearConversationDetailCache() {
	conversationDetailCache.clear();
	inFlightConversationRequests.clear();
}

function toErrorMessage(errorData: unknown, fallback: string) {
	if (
		typeof errorData === "object" &&
		errorData !== null &&
		"error" in errorData &&
		typeof (errorData as { error?: unknown }).error === "string"
	) {
		return (errorData as { error: string }).error;
	}

	return fallback;
}

export async function fetchConversationDetail(
	conversationId: string
): Promise<ConversationDetailPayload> {
	const cachedConversation = getCachedConversationDetail(conversationId);
	if (cachedConversation) {
		return cachedConversation;
	}

	const existingRequest = inFlightConversationRequests.get(conversationId);
	if (existingRequest) {
		return existingRequest;
	}

	const request = (async () => {
		const response = await fetch(`/api/conversations/${conversationId}`, {
			credentials: "include",
		});

		if (!response.ok) {
			let errorData: unknown = null;
			try {
				errorData = await response.json();
			} catch {
				errorData = null;
			}

			throw new Error(
				toErrorMessage(errorData, "Failed to fetch conversation")
			);
		}

		const data = (await response.json()) as {
			conversation: ConversationDetailPayload;
		};

		return cacheConversationDetail(data.conversation);
	})();

	inFlightConversationRequests.set(conversationId, request);

	try {
		return await request;
	} finally {
		inFlightConversationRequests.delete(conversationId);
	}
}
