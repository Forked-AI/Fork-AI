import { RecentChatSwitcher } from '@/components/chat/recent-chat-switcher'
import type { ConversationPreview } from '@/hooks/use-conversations'
import { RECENT_CHAT_LRU_LIMIT } from '@/lib/recent-chat-lru'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockUseConversations = vi.hoisted(() => vi.fn())
const mockUseSettings = vi.hoisted(() => vi.fn())
const mockPathname = vi.hoisted(() => ({ value: '/chat' }))
const mockSearchParams = vi.hoisted(() => new URLSearchParams())

vi.mock('next/navigation', () => ({
	usePathname: () => mockPathname.value,
	useRouter: () => ({
		replace: mockRouterReplace,
	}),
	useSearchParams: () => mockSearchParams,
}))

vi.mock('@/hooks/use-conversations', () => ({
	useConversations: mockUseConversations,
}))

vi.mock('@/hooks/use-settings', () => ({
	useSettings: mockUseSettings,
}))

function createConversation(
	id: string,
	title: string,
	updatedAt = '2026-04-13T00:00:00.000Z'
): ConversationPreview {
	return {
		id,
		title,
		isPinned: false,
		pinnedAt: null,
		lastMessage: {
			id: `${id}-message`,
			role: 'assistant',
			content: `${title} preview`,
			createdAt: updatedAt,
		},
		messageCount: 2,
		collection: null,
		createdAt: updatedAt,
		updatedAt,
	}
}

const conversations = [
	createConversation('chat-1', 'First chat', '2026-04-13T00:00:00.000Z'),
	createConversation('chat-2', 'Second chat', '2026-04-14T00:00:00.000Z'),
	createConversation('chat-3', 'Third chat', '2026-04-15T00:00:00.000Z'),
]

const manyConversations = Array.from({ length: 7 }, (_, index) =>
	createConversation(
		`chat-${index + 1}`,
		`Chat ${index + 1}`,
		`2026-04-${String(index + 10).padStart(2, '0')}T00:00:00.000Z`
	)
)

describe('RecentChatSwitcher', () => {
	beforeEach(() => {
		localStorage.clear()
		mockRouterReplace.mockReset()
		mockPathname.value = '/chat'
		mockSearchParams.delete('c')
		mockUseSettings.mockReturnValue({
			settings: {
				recentChatSwitcherShortcut: 'Alt+Q',
			},
		})
		mockUseConversations.mockReturnValue({
			conversations,
			isError: false,
		})
	})

	it('opens with the configured shortcut and cycles on repeated trigger', () => {
		localStorage.setItem(
			'fork-ai-recent-chat-lru',
			JSON.stringify(['chat-3', 'chat-1', 'chat-2'])
		)
		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })
		expect(
			screen.getByRole('dialog', { name: /recent chat switcher/i })
		).toBeInTheDocument()
		expect(
			screen.getByText('Third chat').closest('[data-selected]')
		).toHaveAttribute('data-selected', 'true')

		fireEvent.keyDown(window, { key: 'q', altKey: true })
		expect(
			screen.getByText('First chat').closest('[data-selected]')
		).toHaveAttribute('data-selected', 'true')
	})

	it('requests the configured LRU preview limit', () => {
		render(<RecentChatSwitcher />)

		expect(mockUseConversations).toHaveBeenCalledWith({
			limit: RECENT_CHAT_LRU_LIMIT,
			pinned: false,
			enabled: true,
		})
	})

	it('renders no more than the LRU preview limit', () => {
		mockUseConversations.mockReturnValue({
			conversations: manyConversations.slice(0, RECENT_CHAT_LRU_LIMIT),
			isError: false,
		})

		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })

		expect(screen.getAllByRole('button')).toHaveLength(RECENT_CHAT_LRU_LIMIT)
		expect(screen.queryByText('Chat 6')).not.toBeInTheDocument()
	})

	it('keeps the current chat visible and selects the next chat first', () => {
		mockSearchParams.set('c', 'chat-3')
		localStorage.setItem(
			'fork-ai-recent-chat-lru',
			JSON.stringify(['chat-3', 'chat-1', 'chat-2'])
		)
		render(<RecentChatSwitcher />)

		expect(
			JSON.parse(localStorage.getItem('fork-ai-recent-chat-lru') ?? '[]')
		).toEqual(['chat-3', 'chat-1', 'chat-2'])

		fireEvent.keyDown(window, { key: 'q', altKey: true })

		expect(screen.getByText('Current')).toBeInTheDocument()
		expect(screen.getAllByRole('button')[0]).toHaveTextContent('Third chat')
		expect(
			screen.getByText('First chat').closest('[data-selected]')
		).toHaveAttribute('data-selected', 'true')
		expect(
			screen.getByText('Third chat').closest('[data-selected]')
		).toHaveAttribute('data-selected', 'false')
	})

	it('moves selection back to the current chat with ArrowUp', () => {
		mockSearchParams.set('c', 'chat-3')
		localStorage.setItem(
			'fork-ai-recent-chat-lru',
			JSON.stringify(['chat-3', 'chat-1', 'chat-2'])
		)
		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })
		fireEvent.keyDown(window, { key: 'ArrowUp' })

		expect(
			screen.getByText('Third chat').closest('[data-selected]')
		).toHaveAttribute('data-selected', 'true')
	})

	it('closes without navigating when the current chat is clicked', () => {
		mockSearchParams.set('c', 'chat-3')
		localStorage.setItem(
			'fork-ai-recent-chat-lru',
			JSON.stringify(['chat-3', 'chat-1', 'chat-2'])
		)
		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })
		fireEvent.click(screen.getByRole('button', { name: /third chat/i }))

		expect(mockRouterReplace).not.toHaveBeenCalled()
		expect(
			screen.queryByRole('dialog', { name: /recent chat switcher/i })
		).not.toBeInTheDocument()
	})

	it('centers the overlay', () => {
		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })

		expect(
			screen.getByRole('dialog', { name: /recent chat switcher/i })
		).toHaveClass('top-1/2', '-translate-y-1/2')
	})

	it('highlights rows on hover and opens clicked chats', () => {
		localStorage.setItem(
			'fork-ai-recent-chat-lru',
			JSON.stringify(['chat-1', 'chat-2', 'chat-3'])
		)
		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })
		const secondChatButton = screen.getByRole('button', {
			name: /second chat/i,
		})

		fireEvent.mouseEnter(secondChatButton)
		expect(secondChatButton).toHaveAttribute('data-selected', 'true')

		fireEvent.click(secondChatButton)
		expect(mockRouterReplace).toHaveBeenCalledWith('/chat?c=chat-2', {
			scroll: false,
		})
	})

	it('opens the highlighted chat when the modifier is released', () => {
		localStorage.setItem(
			'fork-ai-recent-chat-lru',
			JSON.stringify(['chat-1', 'chat-2', 'chat-3'])
		)
		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })
		fireEvent.keyDown(window, { key: 'q', altKey: true })
		fireEvent.keyUp(window, { key: 'Alt' })

		expect(mockRouterReplace).toHaveBeenCalledWith('/chat?c=chat-2', {
			scroll: false,
		})
		expect(
			screen.queryByRole('dialog', { name: /recent chat switcher/i })
		).not.toBeInTheDocument()
	})

	it('cancels with Escape', () => {
		render(<RecentChatSwitcher />)

		fireEvent.keyDown(window, { key: 'q', altKey: true })
		fireEvent.keyDown(window, { key: 'Escape' })

		expect(mockRouterReplace).not.toHaveBeenCalled()
		expect(
			screen.queryByRole('dialog', { name: /recent chat switcher/i })
		).not.toBeInTheDocument()
	})

	it('ignores shortcut events from editable fields', () => {
		render(
			<>
				<input aria-label="Message" />
				<RecentChatSwitcher />
			</>
		)

		fireEvent.keyDown(screen.getByLabelText('Message'), {
			key: 'q',
			altKey: true,
		})

		expect(mockRouterReplace).not.toHaveBeenCalled()
		expect(
			screen.queryByRole('dialog', { name: /recent chat switcher/i })
		).not.toBeInTheDocument()
	})
})
