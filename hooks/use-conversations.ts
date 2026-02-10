import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ConversationPreview {
	id: string;
	title: string;
	lastMessage: {
		id: string;
		role: string;
		content: string;
		createdAt: string;
	} | null;
	messageCount: number;
	collection: {
		id: string;
		name: string;
		color: string;
	} | null;
	createdAt: string;
	updatedAt: string;
}

export interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasMore: boolean;
}

export interface ConversationsResponse {
	conversations: ConversationPreview[];
	pagination: PaginationInfo;
}

export interface UseConversationsOptions {
	page?: number;
	limit?: number;
	collectionId?: string | null;
	search?: string;
	enabled?: boolean;
}

// Fetch conversations list
async function fetchConversations(
	page: number = 1,
	limit: number = 20,
	collectionId?: string | null,
	search?: string
): Promise<ConversationsResponse> {
	const params = new URLSearchParams({
		page: page.toString(),
		limit: limit.toString(),
	});

	if (collectionId !== undefined) {
		params.append(
			"collectionId",
			collectionId === null ? "null" : collectionId
		);
	}

	if (search?.trim()) {
		params.append("search", search.trim());
	}

	const response = await fetch(`/api/conversations?${params}`);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || "Failed to fetch conversations");
	}

	return response.json();
}

// Create a new conversation
async function createConversation(data: {
	title?: string;
	collectionId?: string;
}): Promise<{ conversation: { id: string; title: string } }> {
	const response = await fetch("/api/conversations", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || "Failed to create conversation");
	}

	return response.json();
}

// Delete a conversation
async function deleteConversation(id: string): Promise<void> {
	const response = await fetch(`/api/conversations/${id}`, {
		method: "DELETE",
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || "Failed to delete conversation");
	}
}

// Update conversation (title or collection)
async function updateConversation(
	id: string,
	data: { title?: string; collectionId?: string | null }
): Promise<{ conversation: ConversationPreview }> {
	const response = await fetch(`/api/conversations/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || "Failed to update conversation");
	}

	return response.json();
}

export function useConversations(options: UseConversationsOptions = {}) {
	const {
		page = 1,
		limit = 20,
		collectionId,
		search,
		enabled = true,
	} = options;
	const queryClient = useQueryClient();

	// Query for fetching conversations
	const conversationsQuery = useQuery({
		queryKey: ["conversations", { page, limit, collectionId, search }],
		queryFn: () => fetchConversations(page, limit, collectionId, search),
		enabled,
		staleTime: 30000, // 30 seconds
	});

	// Mutation for creating a conversation
	const createMutation = useMutation({
		mutationFn: createConversation,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["conversations"] });
		},
	});

	// Mutation for deleting a conversation
	const deleteMutation = useMutation({
		mutationFn: deleteConversation,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["conversations"] });
		},
	});

	// Mutation for updating a conversation
	const updateMutation = useMutation({
		mutationFn: ({
			id,
			...data
		}: {
			id: string;
			title?: string;
			collectionId?: string | null;
		}) => updateConversation(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["conversations"] });
		},
	});

	// Helper to invalidate conversations cache
	const invalidateConversations = () => {
		queryClient.invalidateQueries({ queryKey: ["conversations"] });
	};

	return {
		// Query data
		conversations: conversationsQuery.data?.conversations ?? [],
		pagination: conversationsQuery.data?.pagination,
		isLoading: conversationsQuery.isLoading,
		isError: conversationsQuery.isError,
		error: conversationsQuery.error,
		refetch: conversationsQuery.refetch,

		// Mutations
		createConversation: createMutation.mutateAsync,
		isCreating: createMutation.isPending,

		deleteConversation: deleteMutation.mutateAsync,
		isDeleting: deleteMutation.isPending,

		updateConversation: updateMutation.mutateAsync,
		isUpdating: updateMutation.isPending,

		// Helpers
		invalidateConversations,

		// Title generation
		generateTitle: async (conversationId: string) => {
			try {
				// Dispatch event to show skeleton
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("titleGenerating", {
							detail: { conversationId },
						})
					);
				}

				const response = await fetch(
					`/api/conversations/${conversationId}/generate-title`,
					{
						method: "POST",
					}
				);

				if (response.ok) {
					const data = await response.json();
					// Invalidate to refresh the sidebar
					queryClient.invalidateQueries({
						queryKey: ["conversations"],
					});

					// Dispatch event to hide skeleton
					if (typeof window !== "undefined") {
						window.dispatchEvent(
							new CustomEvent("titleGenerated", {
								detail: { conversationId },
							})
						);
					}

					return data.title;
				} else {
					// Hide skeleton on error too
					if (typeof window !== "undefined") {
						window.dispatchEvent(
							new CustomEvent("titleGenerated", {
								detail: { conversationId },
							})
						);
					}
				}
			} catch (error) {
				console.error("Failed to generate title:", error);
				// Hide skeleton on error
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("titleGenerated", {
							detail: { conversationId },
						})
					);
				}
			}
			return null;
		},
	};
}

// Hook for fetching a single conversation with messages
export function useConversation(conversationId: string | null) {
	return useQuery({
		queryKey: ["conversation", conversationId],
		queryFn: async () => {
			if (!conversationId) return null;

			const response = await fetch(
				`/api/conversations/${conversationId}`
			);
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to fetch conversation");
			}

			const data = await response.json();
			return data.conversation;
		},
		enabled: !!conversationId,
		staleTime: 10000, // 10 seconds
		retry: false, // Don't retry on failure (e.g., 404)
	});
}
