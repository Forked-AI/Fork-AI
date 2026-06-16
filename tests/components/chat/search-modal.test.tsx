import { SearchModal } from '@/components/chat/search-modal'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
	useRouter: () => ({
		replace: mockRouterReplace,
	}),
}))

interface ConversationFixture {
	id: string
	title: string
}

function buildConversation(id: string, title: string) {
	return {
		id,
		title,
		lastMessage: null,
		messageCount: 1,
		updatedAt: '2026-04-13T00:00:00.000Z',
	}
}

function buildConversationsResponse(conversations: ReturnType<typeof buildConversation>[]) {
	return new Response(
		JSON.stringify({
			conversations,
			pagination: {
				page: 1,
				limit: 10,
				total: conversations.length,
				totalPages: 1,
				hasMore: false,
			},
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}
	)
}

describe('SearchModal request lifecycle', () => {
	beforeEach(() => {
		mockRouterReplace.mockReset()
		vi.useFakeTimers()
		vi.unstubAllGlobals()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('aborts an in-flight request when the search term changes', async () => {
		const requests: Array<{
			searchTerm: string
			signal: AbortSignal | null
			resolve: (value: Response) => void
		}> = []

		const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
			const url = new URL(String(input), 'http://localhost')
			const searchTerm = url.searchParams.get('search') ?? ''

			if (!searchTerm) {
				return Promise.resolve(buildConversationsResponse([]))
			}

			return new Promise<Response>((resolve, reject) => {
				const signal = (init?.signal as AbortSignal | undefined) ?? null
				if (signal) {
					signal.addEventListener('abort', () => {
						reject(new DOMException('Aborted', 'AbortError'))
					})
				}

				requests.push({ searchTerm, signal, resolve })
			})
		})

		vi.stubGlobal('fetch', fetchMock)

		render(<SearchModal open onOpenChange={vi.fn()} />)
		const input = screen.getByPlaceholderText('Search conversations...')

		fireEvent.change(input, { target: { value: 'alpha' } })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(requests).toHaveLength(1)
		expect(requests[0]?.searchTerm).toBe('alpha')
		expect(requests[0]?.signal?.aborted).toBe(false)

		fireEvent.change(input, { target: { value: 'beta' } })
		expect(requests[0]?.signal?.aborted).toBe(true)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(requests).toHaveLength(2)

		await act(async () => {
			requests[1]?.resolve(
				buildConversationsResponse([buildConversation('c-2', 'Beta chat')])
			)
			await Promise.resolve()
		})

		expect(
			screen.getByRole('option', {
				name: /beta chat/i,
			})
		).toBeInTheDocument()
	})

	it('ignores stale results from older requests that resolve later', async () => {
		const pendingRequests = new Map<string, (value: Response) => void>()

		const fetchMock = vi.fn((input: string | URL) => {
			const url = new URL(String(input), 'http://localhost')
			const searchTerm = url.searchParams.get('search') ?? ''

			if (!searchTerm) {
				return Promise.resolve(buildConversationsResponse([]))
			}

			return new Promise<Response>((resolve) => {
				pendingRequests.set(searchTerm, resolve)
			})
		})

		vi.stubGlobal('fetch', fetchMock)

		render(<SearchModal open onOpenChange={vi.fn()} />)
		const input = screen.getByPlaceholderText('Search conversations...')

		fireEvent.change(input, { target: { value: 'alpha' } })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(pendingRequests.has('alpha')).toBe(true)

		fireEvent.change(input, { target: { value: 'beta' } })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(pendingRequests.has('beta')).toBe(true)

		await act(async () => {
			pendingRequests
				.get('beta')
				?.(buildConversationsResponse([buildConversation('c-2', 'Beta chat')]))
			await Promise.resolve()
		})
		expect(
			screen.getByRole('option', {
				name: /beta chat/i,
			})
		).toBeInTheDocument()

		await act(async () => {
			pendingRequests
				.get('alpha')
				?.(buildConversationsResponse([buildConversation('c-1', 'Alpha chat')]))
			await Promise.resolve()
		})

		expect(
			screen.queryByRole('option', {
				name: /alpha chat/i,
			})
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('option', {
				name: /beta chat/i,
			})
		).toBeInTheDocument()
	})
})
