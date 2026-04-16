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
	createdAt?: string | Date;
	parentMessageId?: string | null;
}

export interface ConversationDetailPayload {
	id: string;
	title: string;
	messages: ConversationMessagePayload[];
}

const inFlightConversationRequests = new Map<
	string,
	Promise<ConversationDetailPayload>
>();

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

		return data.conversation;
	})();

	inFlightConversationRequests.set(conversationId, request);

	try {
		return await request;
	} finally {
		inFlightConversationRequests.delete(conversationId);
	}
}
