import {
	type QueryKey,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

export interface ConversationPreview {
	id: string;
	title: string;
	isPinned: boolean;
	pinnedAt: string | null;
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
	pinned?: boolean;
	enabled?: boolean;
}

interface ConversationQueryFilters {
	page?: number;
	limit?: number;
	collectionId?: string | null;
	search?: string;
	pinned?: boolean;
}

interface CollectionCacheEntry {
	id: string;
	name: string;
	color: string;
	_count: {
		conversations: number;
	};
}

interface UpdateConversationVariables {
	id: string;
	title?: string;
	collectionId?: string | null;
	isPinned?: boolean;
}

interface UpdateConversationContext {
	didOptimisticUpdate: boolean;
	previousCollections?: CollectionCacheEntry[];
	previousConversationQueries: Array<[QueryKey, ConversationsResponse | undefined]>;
}

function isConversationQueryKey(
	queryKey: QueryKey
): queryKey is ["conversations", ConversationQueryFilters] {
	return (
		queryKey[0] === "conversations" &&
		typeof queryKey[1] === "object" &&
		queryKey[1] !== null
	);
}

function normalizeSearch(search?: string) {
	return search?.trim() ?? "";
}

function recalculatePagination(
	pagination: PaginationInfo,
	total: number
): PaginationInfo {
	const totalPages = total > 0 ? Math.ceil(total / pagination.limit) : 0;

	return {
		...pagination,
		total,
		totalPages,
		hasMore: pagination.page < totalPages,
	};
}

function updateCollectionCounts(
	collections: CollectionCacheEntry[],
	sourceCollectionId: string | null,
	targetCollectionId: string | null
) {
	return collections.map((collection) => {
		let conversations = collection._count.conversations;

		if (sourceCollectionId !== null && collection.id === sourceCollectionId) {
			conversations = Math.max(0, conversations - 1);
		}

		if (targetCollectionId !== null && collection.id === targetCollectionId) {
			conversations += 1;
		}

		if (conversations === collection._count.conversations) {
			return collection;
		}

		return {
			...collection,
			_count: {
				...collection._count,
				conversations,
			},
		};
	});
}

// Fetch conversations list
async function fetchConversations(
	page: number = 1,
	limit: number = 20,
	collectionId?: string | null,
	search?: string,
	pinned?: boolean
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

	if (pinned !== undefined) {
		params.append("pinned", pinned ? "true" : "false");
	}

	const response = await fetch(`/api/conversations?${params}`, {
		credentials: "include",
	});

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
		credentials: "include",
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
		credentials: "include",
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || "Failed to delete conversation");
	}
}

// Update conversation (title, collection, or pin state)
async function updateConversation(
	id: string,
	data: { title?: string; collectionId?: string | null; isPinned?: boolean }
): Promise<{ conversation: ConversationPreview }> {
	const response = await fetch(`/api/conversations/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
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
		pinned,
		enabled = true,
	} = options;
	const queryClient = useQueryClient();

	const invalidateConversationRelatedQueries = () => {
		queryClient.invalidateQueries({ queryKey: ["conversations"] });
		queryClient.invalidateQueries({ queryKey: ["collections"] });
	};

	// Query for fetching conversations
	const conversationsQuery = useQuery({
		queryKey: ["conversations", { page, limit, collectionId, search, pinned }],
		queryFn: () => fetchConversations(page, limit, collectionId, search, pinned),
		enabled,
		staleTime: 30000, // 30 seconds
	});

	// Mutation for creating a conversation
	const createMutation = useMutation({
		mutationFn: createConversation,
		onSuccess: () => {
			invalidateConversationRelatedQueries();
		},
	});

	// Mutation for deleting a conversation
	const deleteMutation = useMutation({
		mutationFn: deleteConversation,
		onSuccess: () => {
			invalidateConversationRelatedQueries();
		},
	});

	// Mutation for updating a conversation
	const updateMutation = useMutation({
		mutationFn: ({
			id,
			...data
		}: UpdateConversationVariables) => updateConversation(id, data),
		onMutate: async (variables): Promise<UpdateConversationContext> => {
			if (variables.collectionId === undefined) {
				return {
					didOptimisticUpdate: false,
					previousConversationQueries: [],
				};
			}

			await Promise.all([
				queryClient.cancelQueries({ queryKey: ["conversations"] }),
				queryClient.cancelQueries({ queryKey: ["collections"] }),
			]);

			const previousConversationQueries =
				queryClient.getQueriesData<ConversationsResponse>({
					queryKey: ["conversations"],
				});
			const previousCollections =
				queryClient.getQueryData<CollectionCacheEntry[]>(["collections"]);

			let movedConversation: ConversationPreview | undefined;

			for (const [, data] of previousConversationQueries) {
				const match = data?.conversations.find(
					(conversation) => conversation.id === variables.id
				);
				if (match) {
					movedConversation = match;
					break;
				}
			}

			if (!movedConversation) {
				return {
					didOptimisticUpdate: false,
					previousCollections,
					previousConversationQueries,
				};
			}

			const sourceCollectionId = movedConversation.collection?.id ?? null;
			const targetCollectionId = variables.collectionId;

			if (sourceCollectionId === targetCollectionId) {
				return {
					didOptimisticUpdate: false,
					previousCollections,
					previousConversationQueries,
				};
			}

			const targetCollection =
				targetCollectionId === null
					? null
					: previousCollections?.find(
							(collection) => collection.id === targetCollectionId
						) ?? null;

			if (targetCollectionId !== null && !targetCollection) {
				return {
					didOptimisticUpdate: false,
					previousCollections,
					previousConversationQueries,
				};
			}

			const nextCollection =
				targetCollectionId === null || targetCollection === null
					? null
					: {
							id: targetCollection.id,
							name: targetCollection.name,
							color: targetCollection.color,
						};
			const optimisticConversation: ConversationPreview = {
				...movedConversation,
				collection: nextCollection,
			};

			for (const [queryKey, data] of previousConversationQueries) {
				if (!data || !isConversationQueryKey(queryKey)) {
					continue;
				}

				const filters = queryKey[1];
				const searchTerm = normalizeSearch(filters.search);
				const matchesPinnedFilter =
					filters.pinned === undefined ||
					filters.pinned === movedConversation.isPinned;

				if (!matchesPinnedFilter) {
					continue;
				}

				const hasConversation = data.conversations.some(
					(conversation) => conversation.id === variables.id
				);
				const isSourceCollectionQuery =
					filters.collectionId !== undefined &&
					filters.collectionId === sourceCollectionId;
				const isTargetCollectionQuery =
					filters.collectionId !== undefined &&
					filters.collectionId === targetCollectionId;
				const isGlobalQuery = filters.collectionId === undefined;

				let nextConversations = data.conversations;
				let nextPagination = data.pagination;
				let didChange = false;

				if (isSourceCollectionQuery && (searchTerm === "" || hasConversation)) {
					nextConversations = nextConversations.filter(
						(conversation) => conversation.id !== variables.id
					);
					nextPagination = recalculatePagination(
						nextPagination,
						Math.max(0, nextPagination.total - 1)
					);
					didChange = true;
				}

				if (isTargetCollectionQuery && searchTerm === "") {
					const alreadyPresent = nextConversations.some(
						(conversation) => conversation.id === variables.id
					);

					nextPagination = recalculatePagination(
						nextPagination,
						nextPagination.total + (alreadyPresent ? 0 : 1)
					);

					if ((filters.page ?? 1) === 1) {
						nextConversations = alreadyPresent
							? nextConversations.map((conversation) =>
									conversation.id === variables.id
										? optimisticConversation
										: conversation
								)
							: [optimisticConversation, ...nextConversations].slice(
									0,
									data.pagination.limit
								);
					}

					didChange = true;
				}

				if (isGlobalQuery && hasConversation) {
					nextConversations = nextConversations.map((conversation) =>
						conversation.id === variables.id
							? optimisticConversation
							: conversation
					);
					didChange = true;
				}

				if (didChange) {
					queryClient.setQueryData<ConversationsResponse>(queryKey, {
						...data,
						conversations: nextConversations,
						pagination: nextPagination,
					});
				}
			}

			if (previousCollections) {
				queryClient.setQueryData<CollectionCacheEntry[]>(
					["collections"],
					updateCollectionCounts(
						previousCollections,
						sourceCollectionId,
						targetCollectionId
					)
				);
			}

			return {
				didOptimisticUpdate: true,
				previousCollections,
				previousConversationQueries,
			};
		},
		onError: (_error, _variables, context) => {
			if (!context?.didOptimisticUpdate) {
				return;
			}

			for (const [queryKey, data] of context.previousConversationQueries) {
				if (data === undefined) {
					queryClient.removeQueries({ queryKey, exact: true });
					continue;
				}

				queryClient.setQueryData(queryKey, data);
			}

			if (context.previousCollections === undefined) {
				queryClient.removeQueries({ queryKey: ["collections"], exact: true });
				return;
			}

			queryClient.setQueryData(["collections"], context.previousCollections);
		},
		onSuccess: (_data, variables) => {
			if (variables.collectionId === undefined) {
				invalidateConversationRelatedQueries();
			}
		},
		onSettled: (_data, _error, variables) => {
			if (variables.collectionId !== undefined) {
				invalidateConversationRelatedQueries();
			}
		},
	});

	// Helper to invalidate conversations cache
	const invalidateConversations = () => {
		invalidateConversationRelatedQueries();
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
						credentials: "include",
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
				`/api/conversations/${conversationId}`,
				{ credentials: "include" }
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
