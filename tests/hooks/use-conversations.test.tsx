import {
	type ConversationPreview,
	type ConversationsResponse,
	useConversations,
} from '@/hooks/use-conversations'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		)
	}
}

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
			mutations: {
				retry: false,
			},
		},
	})
}

function createCollection(
	id: string,
	name: string,
	color: string,
	conversations: number
) {
	return {
		id,
		name,
		color,
		_count: {
			conversations,
		},
	}
}

function createConversation(
	id: string,
	collection: ConversationPreview['collection'],
	overrides: Partial<ConversationPreview> = {}
): ConversationPreview {
	return {
		id,
		title: `Chat ${id}`,
		isPinned: false,
		pinnedAt: null,
		lastMessage: null,
		messageCount: 3,
		collection,
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides,
	}
}

function createResponse(
	conversations: ConversationPreview[],
	overrides: Partial<ConversationsResponse['pagination']> = {}
): ConversationsResponse {
	const page = overrides.page ?? 1
	const limit = overrides.limit ?? 100
	const total = overrides.total ?? conversations.length
	const totalPages =
		overrides.totalPages ?? (total > 0 ? Math.ceil(total / limit) : 0)
	const hasMore = overrides.hasMore ?? page < totalPages

	return {
		conversations,
		pagination: {
			page,
			limit,
			total,
			totalPages,
			hasMore,
		},
	}
}

function createDeferredFetch() {
	let resolve!: (value: Response) => void
	let reject!: (reason?: unknown) => void

	const promise = new Promise<Response>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

function sourceFolderKey(folderId: string | null) {
	return [
		'conversations',
		{
			page: 1,
			limit: 100,
			collectionId: folderId,
			search: undefined,
			pinned: undefined,
		},
	] as const
}

describe('useConversations', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('keeps invalidateConversations stable across rerenders', () => {
		const queryClient = createQueryClient()
		const wrapper = createWrapper(queryClient)
		const { result, rerender } = renderHook(
			() => useConversations({ enabled: false }),
			{
				wrapper,
			}
		)

		const initialInvalidateConversations = result.current.invalidateConversations

		rerender()

		expect(result.current.invalidateConversations).toBe(
			initialInvalidateConversations
		)
	})
})

describe('useConversations optimistic moves', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('removes a moved chat from the source folder cache immediately', async () => {
		const queryClient = createQueryClient()
		const wrapper = createWrapper(queryClient)
		const deferred = createDeferredFetch()
		const alpha = { id: 'folder-1', name: 'Alpha', color: '#57FCFF' }
		const beta = { id: 'folder-2', name: 'Beta', color: '#FF6B9D' }
		const sourceKey = sourceFolderKey(alpha.id)

		queryClient.setQueryData(sourceKey, createResponse([createConversation('chat-1', alpha)]))
		queryClient.setQueryData(['collections'], [
			createCollection(alpha.id, alpha.name, alpha.color, 1),
			createCollection(beta.id, beta.name, beta.color, 0),
		])

		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => deferred.promise))

		const { result } = renderHook(() => useConversations({ enabled: false }), {
			wrapper,
		})

		let pendingMove!: Promise<unknown>
		act(() => {
			pendingMove = result.current.updateConversation({
				id: 'chat-1',
				collectionId: beta.id,
			})
		})

		await waitFor(() => {
			expect(
				queryClient.getQueryData<ConversationsResponse>(sourceKey)
			).toEqual(createResponse([], { total: 0, totalPages: 0, hasMore: false }))
		})

		deferred.resolve({
			ok: true,
			json: async () => ({
				conversation: createConversation('chat-1', beta),
			}),
		} as Response)

		await act(async () => {
			await pendingMove
		})
	})

	it('updates target folder counts and inserts into page 1 target cache', async () => {
		const queryClient = createQueryClient()
		const wrapper = createWrapper(queryClient)
		const deferred = createDeferredFetch()
		const alpha = { id: 'folder-1', name: 'Alpha', color: '#57FCFF' }
		const beta = { id: 'folder-2', name: 'Beta', color: '#FF6B9D' }
		const sourceKey = sourceFolderKey(alpha.id)
		const targetKey = sourceFolderKey(beta.id)

		queryClient.setQueryData(sourceKey, createResponse([createConversation('chat-1', alpha)]))
		queryClient.setQueryData(
			targetKey,
			createResponse([], { total: 12, totalPages: 1, hasMore: false })
		)
		queryClient.setQueryData(['collections'], [
			createCollection(alpha.id, alpha.name, alpha.color, 1),
			createCollection(beta.id, beta.name, beta.color, 12),
		])

		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => deferred.promise))

		const { result } = renderHook(() => useConversations({ enabled: false }), {
			wrapper,
		})

		let pendingMove!: Promise<unknown>
		act(() => {
			pendingMove = result.current.updateConversation({
				id: 'chat-1',
				collectionId: beta.id,
			})
		})

		await waitFor(() => {
			expect(
				queryClient.getQueryData<ConversationsResponse>(targetKey)
			).toEqual(
				createResponse([createConversation('chat-1', beta)], {
					total: 13,
					totalPages: 1,
					hasMore: false,
				})
			)
			expect(queryClient.getQueryData(['collections'])).toEqual([
				createCollection(alpha.id, alpha.name, alpha.color, 0),
				createCollection(beta.id, beta.name, beta.color, 13),
			])
		})

		deferred.resolve({
			ok: true,
			json: async () => ({
				conversation: createConversation('chat-1', beta),
			}),
		} as Response)

		await act(async () => {
			await pendingMove
		})
	})

	it('updates uncategorized totals and source folder counts when moving to uncategorized', async () => {
		const queryClient = createQueryClient()
		const wrapper = createWrapper(queryClient)
		const deferred = createDeferredFetch()
		const alpha = { id: 'folder-1', name: 'Alpha', color: '#57FCFF' }
		const uncategorizedKey = sourceFolderKey(null)
		const sourceKey = sourceFolderKey(alpha.id)
		const uncategorizedExisting = createConversation('chat-2', null)

		queryClient.setQueryData(sourceKey, createResponse([createConversation('chat-1', alpha)]))
		queryClient.setQueryData(
			uncategorizedKey,
			createResponse([uncategorizedExisting], {
				total: 2,
				totalPages: 1,
				hasMore: false,
			})
		)
		queryClient.setQueryData(['collections'], [
			createCollection(alpha.id, alpha.name, alpha.color, 1),
		])

		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => deferred.promise))

		const { result } = renderHook(() => useConversations({ enabled: false }), {
			wrapper,
		})

		let pendingMove!: Promise<unknown>
		act(() => {
			pendingMove = result.current.updateConversation({
				id: 'chat-1',
				collectionId: null,
			})
		})

		await waitFor(() => {
			expect(
				queryClient.getQueryData<ConversationsResponse>(uncategorizedKey)
			).toEqual(
				createResponse(
					[createConversation('chat-1', null), uncategorizedExisting],
					{
						total: 3,
						totalPages: 1,
						hasMore: false,
					}
				)
			)
			expect(queryClient.getQueryData(['collections'])).toEqual([
				createCollection(alpha.id, alpha.name, alpha.color, 0),
			])
		})

		deferred.resolve({
			ok: true,
			json: async () => ({
				conversation: createConversation('chat-1', null),
			}),
		} as Response)

		await act(async () => {
			await pendingMove
		})
	})

	it('keeps chats in global lists and updates their collection metadata', async () => {
		const queryClient = createQueryClient()
		const wrapper = createWrapper(queryClient)
		const deferred = createDeferredFetch()
		const alpha = { id: 'folder-1', name: 'Alpha', color: '#57FCFF' }
		const beta = { id: 'folder-2', name: 'Beta', color: '#FF6B9D' }
		const globalKey = [
			'conversations',
			{
				page: 1,
				limit: 10,
				collectionId: undefined,
				search: undefined,
				pinned: false,
			},
		] as const

		queryClient.setQueryData(globalKey, createResponse([createConversation('chat-1', alpha)]))
		queryClient.setQueryData(['collections'], [
			createCollection(alpha.id, alpha.name, alpha.color, 1),
			createCollection(beta.id, beta.name, beta.color, 0),
		])

		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => deferred.promise))

		const { result } = renderHook(() => useConversations({ enabled: false }), {
			wrapper,
		})

		let pendingMove!: Promise<unknown>
		act(() => {
			pendingMove = result.current.updateConversation({
				id: 'chat-1',
				collectionId: beta.id,
			})
		})

		await waitFor(() => {
			expect(
				queryClient.getQueryData<ConversationsResponse>(globalKey)
			).toEqual(createResponse([createConversation('chat-1', beta)]))
		})

		deferred.resolve({
			ok: true,
			json: async () => ({
				conversation: createConversation('chat-1', beta),
			}),
		} as Response)

		await act(async () => {
			await pendingMove
		})
	})

	it('rolls back conversation caches and folder counts when a move fails', async () => {
		const queryClient = createQueryClient()
		const wrapper = createWrapper(queryClient)
		const deferred = createDeferredFetch()
		const alpha = { id: 'folder-1', name: 'Alpha', color: '#57FCFF' }
		const beta = { id: 'folder-2', name: 'Beta', color: '#FF6B9D' }
		const sourceKey = sourceFolderKey(alpha.id)
		const targetKey = sourceFolderKey(beta.id)
		const initialSource = createResponse([createConversation('chat-1', alpha)])
		const initialTarget = createResponse([], {
			total: 12,
			totalPages: 1,
			hasMore: false,
		})
		const initialCollections = [
			createCollection(alpha.id, alpha.name, alpha.color, 1),
			createCollection(beta.id, beta.name, beta.color, 12),
		]

		queryClient.setQueryData(sourceKey, initialSource)
		queryClient.setQueryData(targetKey, initialTarget)
		queryClient.setQueryData(['collections'], initialCollections)

		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => deferred.promise))

		const { result } = renderHook(() => useConversations({ enabled: false }), {
			wrapper,
		})

		let pendingMove!: Promise<unknown>
		act(() => {
			pendingMove = result.current.updateConversation({
				id: 'chat-1',
				collectionId: beta.id,
			})
		})

		await waitFor(() => {
			expect(
				queryClient.getQueryData<ConversationsResponse>(sourceKey)
			).toEqual(createResponse([], { total: 0, totalPages: 0, hasMore: false }))
		})

		deferred.reject(new Error('Move failed'))

		await expect(pendingMove).rejects.toThrow('Move failed')

		await waitFor(() => {
			expect(queryClient.getQueryData(sourceKey)).toEqual(initialSource)
			expect(queryClient.getQueryData(targetKey)).toEqual(initialTarget)
			expect(queryClient.getQueryData(['collections'])).toEqual(
				initialCollections
			)
		})
	})

	it('falls back cleanly when the source chat is not cached and still invalidates on settle', async () => {
		const queryClient = createQueryClient()
		const wrapper = createWrapper(queryClient)
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
		const beta = { id: 'folder-2', name: 'Beta', color: '#FF6B9D' }
		const globalKey = [
			'conversations',
			{
				page: 1,
				limit: 10,
				collectionId: undefined,
				search: undefined,
				pinned: false,
			},
		] as const
		const initialGlobal = createResponse([])

		queryClient.setQueryData(globalKey, initialGlobal)
		queryClient.setQueryData(['collections'], [
			createCollection(beta.id, beta.name, beta.color, 12),
		])

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					conversation: createConversation('chat-404', beta),
				}),
			})
		)

		const { result } = renderHook(() => useConversations({ enabled: false }), {
			wrapper,
		})

		await act(async () => {
			await result.current.updateConversation({
				id: 'chat-404',
				collectionId: beta.id,
			})
		})

		expect(queryClient.getQueryData(globalKey)).toEqual(initialGlobal)

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['conversations'],
			})
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['collections'],
			})
		})
	})
})
