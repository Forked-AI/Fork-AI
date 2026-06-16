import { useDeleteCollection, useMoveConversation } from '@/hooks/use-collections'
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

describe('useCollections mutations', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('invalidates collections and conversations after deleting a folder', async () => {
		const queryClient = new QueryClient()
		const wrapper = createWrapper(queryClient)
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ success: true }),
			})
		)

		const { result } = renderHook(() => useDeleteCollection(), { wrapper })

		await act(async () => {
			await result.current.mutateAsync('collection-1')
		})

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['collections'],
			})
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['conversations'],
			})
		})
	})

	it('invalidates collections and conversations after moving a chat', async () => {
		const queryClient = new QueryClient()
		const wrapper = createWrapper(queryClient)
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ success: true }),
			})
		)

		const { result } = renderHook(() => useMoveConversation(), { wrapper })

		await act(async () => {
			await result.current.mutateAsync({
				conversationId: 'chat-1',
				collectionId: null,
			})
		})

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['collections'],
			})
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['conversations'],
			})
		})
	})
})
