import { Sidebar } from '@/components/chat/sidebar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockSearchParams = vi.hoisted(() => ({ value: '' }))
const mockPathname = vi.hoisted(() => ({ value: '/chat' }))
const mockSetSettingsOpen = vi.hoisted(() => vi.fn())
const mockDeleteConversation = vi.fn()
const mockUpdateConversation = vi.fn()
const mockInvalidateConversations = vi.fn()
const mockToast = vi.fn()
const selectiveShareModalSpy = vi.fn()
const mockUseConversations = vi.fn()
let mockCompactMode = false

vi.mock('next/navigation', () => ({
	useRouter: () => ({
		replace: mockRouterReplace,
	}),
	useSearchParams: () => new URLSearchParams(mockSearchParams.value),
	usePathname: () => mockPathname.value,
}))

const collections = [
	{
		id: 'folder-1',
		name: 'Alpha',
		color: '#57FCFF',
		userId: 'user-1',
		isDefault: false,
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		_count: {
			conversations: 2,
		},
	},
	{
		id: 'folder-2',
		name: 'Beta',
		color: '#FF6B9D',
		userId: 'user-1',
		isDefault: false,
		createdAt: '2025-01-02T00:00:00.000Z',
		updatedAt: '2025-01-02T00:00:00.000Z',
		_count: {
			conversations: 1,
		},
	},
]

type SidebarConversationFixture = {
	id: string
	title: string
	isPinned: boolean
	pinnedAt: string | null
	messageCount: number
	lastMessage: null
	collection: { id: string; name: string; color: string } | null
	createdAt: string
	updatedAt: string
}

const pinnedConversation: SidebarConversationFixture = {
	id: 'conversation-pinned',
	title: 'Pinned roadmap',
	isPinned: true,
	pinnedAt: '2025-01-03T00:00:00.000Z',
	messageCount: 3,
	lastMessage: null,
	collection: {
		id: 'folder-2',
		name: 'Beta',
		color: '#FF6B9D',
	},
	createdAt: '2025-01-03T00:00:00.000Z',
	updatedAt: '2025-01-04T00:00:00.000Z',
}

const recentConversations: SidebarConversationFixture[] = [
	{
		id: 'conversation-1',
		title: 'Project plan',
		isPinned: false,
		pinnedAt: null,
		messageCount: 4,
		lastMessage: null,
		collection: null,
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-05T00:00:00.000Z',
	},
	{
		id: 'conversation-empty',
		title: 'Empty thread',
		isPinned: false,
		pinnedAt: null,
		messageCount: 0,
		lastMessage: null,
		collection: null,
		createdAt: '2025-01-02T00:00:00.000Z',
		updatedAt: '2025-01-06T00:00:00.000Z',
	},
]

vi.mock('@/contexts/auth-context', () => ({
	useAuth: () => ({
		user: { id: 'user-1' },
	}),
}))

vi.mock('@/hooks/use-settings', () => ({
	useSettings: () => ({
		settings: {
			compactMode: mockCompactMode,
		},
		updateSettings: vi.fn(),
		isLoaded: true,
	}),
}))

vi.mock('@/hooks/use-collections', () => ({
	useCollections: () => ({
		data: collections,
		isLoading: false,
		error: null,
	}),
}))

vi.mock('@/hooks/use-conversations', () => ({
	useConversations: (options?: unknown) => mockUseConversations(options),
}))

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({
		toast: mockToast,
	}),
}))

vi.mock('@/components/chat/chat-ui-provider', () => ({
	useChatUI: () => ({
		settingsOpen: false,
		setSettingsOpen: mockSetSettingsOpen,
		openSettings: vi.fn(),
		closeSettings: vi.fn(),
		generatingTitleIds: new Set<string>(),
	}),
}))

vi.mock('@/components/chat/collections-modal', () => ({
	CollectionsModal: () => null,
}))

vi.mock('@/components/chat/placeholder-modal', () => ({
	PlaceholderModal: () => null,
}))

vi.mock('@/components/chat/search-modal', () => ({
	SearchModal: () => null,
}))

vi.mock('@/components/chat/settings-modal', () => ({
	SettingsModal: () => null,
}))

vi.mock('@/components/chat/selective-share-modal', () => ({
	SelectiveShareModal: (props: {
		open: boolean
		conversationTitle: string
		selectedMessageIds: string[]
	}) => {
		selectiveShareModalSpy(props)

		if (!props.open) return null

		return (
			<div data-testid="share-modal">
				{props.conversationTitle}:{props.selectedMessageIds.join(',')}
			</div>
		)
	},
}))

function getConversationResult(conversations: SidebarConversationFixture[]) {
	return {
		conversations,
		pagination: {
			page: 1,
			limit: 10,
			total: conversations.length,
			totalPages: 1,
			hasMore: false,
		},
		isLoading: false,
		deleteConversation: mockDeleteConversation,
		isDeleting: false,
		updateConversation: mockUpdateConversation,
		isUpdating: false,
		invalidateConversations: mockInvalidateConversations,
	}
}

function QueryWrapper({ children }: { children: ReactNode }) {
	const [queryClient] = React.useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { retry: false },
					mutations: { retry: false },
				},
			})
	)
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)
}

function renderSidebar() {
	return render(<Sidebar />, { wrapper: QueryWrapper })
}

function getLastMenu() {
	return screen.getAllByRole('menu').at(-1)
}

function getMenuItemLabels(menu: HTMLElement) {
	return within(menu)
		.getAllByRole('menuitem')
		.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())
}

describe('Sidebar context menus', () => {
	beforeEach(() => {
		mockRouterReplace.mockReset()
		mockSearchParams.value = ''
		mockPathname.value = '/chat'
		mockSetSettingsOpen.mockReset()
		mockCompactMode = false
		mockDeleteConversation.mockReset()
		mockUpdateConversation.mockReset()
		mockInvalidateConversations.mockReset()
		mockToast.mockReset()
		selectiveShareModalSpy.mockReset()
		vi.unstubAllGlobals()

		mockUseConversations.mockImplementation(
			(options?: { pinned?: boolean; limit?: number }) => {
				if (options?.pinned === true) {
					return getConversationResult([pinnedConversation])
				}

				return getConversationResult(recentConversations)
			}
		)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('shows the same ordered actions in the ellipsis menu and on right-click', async () => {
		const user = userEvent.setup()

		renderSidebar()
		const moreActionsButton = screen.getByRole('button', {
			name: 'More actions for Project plan',
		})

		expect(moreActionsButton).toBeVisible()
		expect(moreActionsButton.className).not.toContain('opacity-0')
		expect(moreActionsButton.className).toContain(
			'focus-visible:bg-sidebar-accent/50'
		)

		await user.click(moreActionsButton)

		await waitFor(() => {
			expect(getLastMenu()).toBeTruthy()
		})

		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Open chat',
			'Rename',
			'Share',
			'Move to...',
			'Pin chat',
			'Delete chat',
		])

		fireEvent.contextMenu(screen.getByText('Project plan'))

		await waitFor(() => {
			expect(getLastMenu()).toBeTruthy()
		})

		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Open chat',
			'Rename',
			'Share',
			'Move to...',
			'Pin chat',
			'Delete chat',
		])
	})

	it('reveals recent chat row actions when compact mode expands on hover', async () => {
		mockCompactMode = true
		const user = userEvent.setup()
		const { container } = renderSidebar()
		const sidebar = container.querySelector('aside')

		expect(sidebar).toBeTruthy()
		expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
		expect(screen.queryByText('Recent')).not.toBeInTheDocument()
		expect(screen.queryByText('Project plan')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', {
				name: 'More actions for Project plan',
			})
		).not.toBeInTheDocument()

		fireEvent.mouseEnter(sidebar!)

		await waitFor(() => {
			expect(screen.getByText('Pinned')).toBeInTheDocument()
			expect(screen.getByText('Recent')).toBeInTheDocument()
			expect(screen.getByText('Project plan')).toBeInTheDocument()
		})

		const moreActionsButton = screen.getByRole('button', {
			name: 'More actions for Project plan',
		})
		expect(moreActionsButton).toBeVisible()
		expect(moreActionsButton.className).not.toContain('opacity-0')

		await user.click(moreActionsButton)

		await waitFor(() => {
			expect(getLastMenu()).toBeTruthy()
		})

		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Open chat',
			'Rename',
			'Share',
			'Move to...',
			'Pin chat',
			'Delete chat',
		])

		fireEvent.mouseLeave(sidebar!)

		expect(screen.getByText('Pinned')).toBeInTheDocument()
		expect(screen.getByText('Recent')).toBeInTheDocument()
		expect(screen.getByText('Project plan')).toBeInTheDocument()
		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Open chat',
			'Rename',
			'Share',
			'Move to...',
			'Pin chat',
			'Delete chat',
		])

		fireEvent.keyDown(document, { key: 'Escape' })

		await waitFor(() => {
			expect(screen.queryAllByRole('menu')).toHaveLength(0)
			expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
			expect(screen.queryByText('Recent')).not.toBeInTheDocument()
			expect(screen.queryByText('Project plan')).not.toBeInTheDocument()
		})
		expect(
			screen.queryByRole('button', {
				name: 'More actions for Project plan',
			})
		).not.toBeInTheDocument()
	})

	it('keeps the compact sidebar expanded while the right-click menu is open', async () => {
		mockCompactMode = true
		const { container } = renderSidebar()
		const sidebar = container.querySelector('aside')

		expect(sidebar).toBeTruthy()

		fireEvent.mouseEnter(sidebar!)

		await waitFor(() => {
			expect(screen.getByText('Project plan')).toBeInTheDocument()
		})

		fireEvent.contextMenu(screen.getByText('Project plan'))

		await waitFor(() => {
			expect(getLastMenu()).toBeTruthy()
		})

		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Open chat',
			'Rename',
			'Share',
			'Move to...',
			'Pin chat',
			'Delete chat',
		])

		fireEvent.mouseLeave(sidebar!)

		expect(screen.getByText('Project plan')).toBeInTheDocument()
		expect(getMenuItemLabels(getLastMenu()!)).toEqual([
			'Open chat',
			'Rename',
			'Share',
			'Move to...',
			'Pin chat',
			'Delete chat',
		])

		fireEvent.keyDown(document, { key: 'Escape' })

		await waitFor(() => {
			expect(screen.queryAllByRole('menu')).toHaveLength(0)
			expect(screen.queryByText('Project plan')).not.toBeInTheDocument()
		})
	})

	it('supports rename, move, pin, and delete from the sidebar menus', async () => {
		const user = userEvent.setup()

		renderSidebar()

		expect(screen.getByText('Pinned')).toBeInTheDocument()
		expect(screen.getByText('Pinned roadmap')).toBeInTheDocument()
		expect(screen.getByText('Recent')).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: 'More actions for Project plan' })
		)
		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Rename' })
		)

		const renameInput = await screen.findByDisplayValue('Project plan')
		await user.clear(renameInput)
		await user.type(renameInput, 'Renamed project')
		await user.click(screen.getByRole('button', { name: 'Save' }))

		expect(mockUpdateConversation).toHaveBeenCalledWith({
			id: 'conversation-1',
			title: 'Renamed project',
		})

		await user.click(
			screen.getByRole('button', { name: 'More actions for Project plan' })
		)
		const moveTrigger = within(getLastMenu()!).getByRole('menuitem', {
			name: 'Move to...',
		})
		await act(async () => {
			moveTrigger.focus()
			fireEvent.keyDown(moveTrigger, { key: 'ArrowRight' })
		})

		const alphaDestination = await screen.findByRole('menuitem', {
			name: 'Alpha',
		})
		await user.click(alphaDestination)

		await waitFor(() => {
			expect(mockUpdateConversation).toHaveBeenCalledWith({
				id: 'conversation-1',
				collectionId: 'folder-1',
			})
		})

		await user.click(
			screen.getByRole('button', { name: 'More actions for Project plan' })
		)
		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Pin chat' })
		)

		expect(mockUpdateConversation).toHaveBeenCalledWith({
			id: 'conversation-1',
			isPinned: true,
		})

		fireEvent.contextMenu(screen.getByText('Project plan'))
		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Delete chat' })
		)

		expect(mockDeleteConversation).toHaveBeenCalledWith('conversation-1')

		await user.click(
			screen.getByRole('button', { name: 'More actions for Pinned roadmap' })
		)
		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Unpin chat' })
		)

		expect(mockUpdateConversation).toHaveBeenCalledWith({
			id: 'conversation-pinned',
			isPinned: false,
		})
	}, 10_000)

	it('disables share for empty chats and opens the selective share flow after lazy loading', async () => {
		const user = userEvent.setup()
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				conversation: {
					id: 'conversation-1',
					title: 'Project plan',
					messages: [
						{
							id: 'message-1',
							role: 'user',
							content: 'Start a plan',
							model: null,
							isError: false,
							promptTokens: null,
							completionTokens: null,
							parentMessageId: null,
							createdAt: '2025-01-01T00:00:00.000Z',
						},
						{
							id: 'message-2',
							role: 'assistant',
							content: 'Here is the plan',
							model: 'gpt-5',
							isError: false,
							promptTokens: null,
							completionTokens: null,
							parentMessageId: 'message-1',
							createdAt: '2025-01-01T00:01:00.000Z',
						},
					],
				},
			}),
		})
		vi.stubGlobal('fetch', fetchMock)

		renderSidebar()

		await user.click(
			screen.getByRole('button', { name: 'More actions for Empty thread' })
		)

		expect(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Share' })
		).toHaveAttribute('data-disabled')

		fireEvent.keyDown(document, { key: 'Escape' })

		await user.click(
			screen.getByRole('button', { name: 'More actions for Project plan' })
		)
		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Share' })
		)

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				'/api/conversations/conversation-1',
				{ credentials: 'include' }
			)
			expect(screen.getByTestId('share-modal')).toHaveTextContent(
				'Project plan:message-1,message-2'
			)
		})
	})

	it('opens a chat from the context menu', async () => {
		const user = userEvent.setup()

		renderSidebar()

		fireEvent.contextMenu(screen.getByText('Project plan'))

		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Open chat' })
		)

		expect(mockRouterReplace).toHaveBeenCalledWith('/chat?c=conversation-1', {
			scroll: false,
		})
	})

	it('routes to the shares page and highlights the library item', async () => {
		const user = userEvent.setup()

		const { rerender } = renderSidebar()

		await user.click(screen.getByRole('button', { name: 'Shares' }))

		expect(mockRouterReplace).toHaveBeenCalledWith('/chat/shares', {
			scroll: false,
		})

		mockPathname.value = '/chat/shares'
		rerender(<Sidebar />)

		const sharesButton = screen.getByRole('button', { name: 'Shares' })
		expect(sharesButton).toHaveAttribute('aria-current', 'page')
		expect(sharesButton.className).toContain('bg-primary/10')
	})
})
