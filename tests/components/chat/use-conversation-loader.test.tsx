import { useConversationLoader } from '@/components/chat/use-conversation-loader'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockNavigationState = vi.hoisted(() => ({
	search: '',
}))

vi.mock('next/navigation', () => ({
	useRouter: () => ({
		replace: mockRouterReplace,
	}),
	useSearchParams: () => ({
		get: (key: string) =>
			new URLSearchParams(mockNavigationState.search).get(key),
	}),
}))

describe('useConversationLoader', () => {
	beforeEach(() => {
		mockRouterReplace.mockReset()
		mockNavigationState.search = ''
		sessionStorage.clear()
	})

	it('does not reload a newly created conversation while the first reply is streaming', () => {
		mockNavigationState.search = 'c=conversation-new'
		const loadConversation = vi.fn()
		const clearMessages = vi.fn()

		renderHook(() =>
			useConversationLoader({
				conversationId: null,
				loadConversation,
				clearMessages,
				isStreaming: true,
				suppressLoadConversationId: 'conversation-new',
			})
		)

		expect(loadConversation).not.toHaveBeenCalled()
		expect(clearMessages).not.toHaveBeenCalled()
	})

	it('loads the route conversation once streaming has finished', () => {
		mockNavigationState.search = 'c=conversation-new'
		const loadConversation = vi.fn()

		renderHook(() =>
			useConversationLoader({
				conversationId: null,
				loadConversation,
				clearMessages: vi.fn(),
				isStreaming: false,
				suppressLoadConversationId: 'conversation-new',
			})
		)

		expect(loadConversation).toHaveBeenCalledWith('conversation-new')
	})

	it('still loads a different conversation immediately during streaming', () => {
		mockNavigationState.search = 'c=conversation-other'
		const loadConversation = vi.fn()

		renderHook(() =>
			useConversationLoader({
				conversationId: 'conversation-new',
				loadConversation,
				clearMessages: vi.fn(),
				isStreaming: true,
				suppressLoadConversationId: 'conversation-new',
			})
		)

		expect(loadConversation).toHaveBeenCalledWith('conversation-other')
	})

	it('does not clear messages while a newly created chat URL is still synchronizing', () => {
		const clearMessages = vi.fn()
		const loadConversation = vi.fn()
		type LoaderProps = {
			conversationId: string | null
			isStreaming: boolean
		}

		const { rerender } = renderHook(
			({ conversationId, isStreaming }: LoaderProps) =>
				useConversationLoader({
					conversationId,
					loadConversation,
					clearMessages,
					isStreaming,
					suppressLoadConversationId: 'conversation-new',
				}),
			{
				initialProps: {
					conversationId: null,
					isStreaming: true,
				} as LoaderProps,
			}
		)

		rerender({ conversationId: 'conversation-new', isStreaming: true })
		expect(clearMessages).not.toHaveBeenCalled()

		rerender({ conversationId: 'conversation-new', isStreaming: false })

		expect(clearMessages).not.toHaveBeenCalled()
	})

	it('clears messages when URL moves from selected conversation to empty chat', () => {
		mockNavigationState.search = 'c=conversation-1'
		const clearMessages = vi.fn()
		const loadConversation = vi.fn()

		const { rerender } = renderHook(() =>
			useConversationLoader({
				conversationId: 'conversation-1',
				loadConversation,
				clearMessages,
				isStreaming: false,
			})
		)

		mockNavigationState.search = ''
		rerender()

		expect(clearMessages).toHaveBeenCalledTimes(1)
	})

	it('defers clear until stream ends if URL leaves selected conversation mid-stream', () => {
		mockNavigationState.search = 'c=conversation-1'
		const clearMessages = vi.fn()
		const loadConversation = vi.fn()

		const { rerender } = renderHook(
			({ isStreaming }: { isStreaming: boolean }) =>
				useConversationLoader({
					conversationId: 'conversation-1',
					loadConversation,
					clearMessages,
					isStreaming,
				}),
			{ initialProps: { isStreaming: true } }
		)

		mockNavigationState.search = ''
		rerender({ isStreaming: true })
		expect(clearMessages).not.toHaveBeenCalled()

		rerender({ isStreaming: false })
		expect(clearMessages).toHaveBeenCalledTimes(1)
	})
})
