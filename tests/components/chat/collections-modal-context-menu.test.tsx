import { CollectionsModal } from '@/components/chat/collections-modal'
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockMutateAsync = vi.fn()
const mockUseConversations = vi.fn()
const mockUpdateConversation = vi.fn()
const mockDeleteConversation = vi.fn()
const mockInvalidateConversations = vi.fn()

vi.mock('next/navigation', () => ({
	useRouter: () => ({
		replace: mockRouterReplace,
	}),
}))

const baseCollections = [
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
		isDefault: true,
		createdAt: '2025-01-02T00:00:00.000Z',
		updatedAt: '2025-01-02T00:00:00.000Z',
		_count: {
			conversations: 1,
		},
	},
]

vi.mock('@/hooks/use-collections', () => ({
	useCollections: () => ({
		data: baseCollections,
		isLoading: false,
		error: null,
	}),
	useCreateCollection: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
	useUpdateCollection: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
	useDeleteCollection: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}))

vi.mock('@/hooks/use-conversations', () => ({
	useConversations: (options?: unknown) => mockUseConversations(options),
}))

function createConversationResult(
	conversations: Array<{
		id: string
		title: string
		messageCount: number
		collection: { id: string; name: string; color: string } | null
	}>,
	overrides?: Partial<{
		page: number
		limit: number
		total: number
		totalPages: number
		hasMore: boolean
	}>
) {
	return {
		conversations: conversations.map((conversation) => ({
			...conversation,
			lastMessage: null,
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z',
		})),
		pagination: {
			page: 1,
			limit: 100,
			total: conversations.length,
			totalPages: 1,
			hasMore: false,
			...overrides,
		},
		isLoading: false,
		updateConversation: mockUpdateConversation,
		deleteConversation: mockDeleteConversation,
		invalidateConversations: mockInvalidateConversations,
	}
}

function getLastMenu() {
	return screen.getAllByRole('menu').at(-1)
}

function getMenuItemLabels(menu: HTMLElement) {
	return within(menu)
		.getAllByRole('menuitem')
		.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())
}

describe('CollectionsModal context menus', () => {
	beforeEach(() => {
		mockRouterReplace.mockReset()
		mockMutateAsync.mockReset()
		mockUseConversations.mockReset()
		mockUpdateConversation.mockReset()
		mockDeleteConversation.mockReset()
		mockInvalidateConversations.mockReset()

		mockUseConversations.mockImplementation(
			(options?: { collectionId?: string | null }) => {
				if (options?.collectionId === 'folder-1') {
					return createConversationResult([
						{
							id: 'chat-1',
							title: 'Alpha planning',
							messageCount: 3,
							collection: {
								id: 'folder-1',
								name: 'Alpha',
								color: '#57FCFF',
							},
						},
					])
				}

				if (options?.collectionId === null) {
					return createConversationResult(
						[
							{
								id: 'chat-uncategorized',
								title: 'Loose note',
								messageCount: 1,
								collection: null,
							},
						],
						{
							total: 1,
						}
					)
				}

				return createConversationResult([], {
					total: 0,
				})
			}
		)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('shows the expected right-click actions for uncategorized, regular, and default folders', async () => {
		const user = userEvent.setup()

		render(<CollectionsModal open onOpenChange={vi.fn()} />)

		fireEvent.contextMenu(screen.getByText('Uncategorized'))

		await waitFor(() => {
			expect(getLastMenu()).toBeTruthy()
		})

		expect(getMenuItemLabels(getLastMenu()!)).toEqual(['Open folder'])

		fireEvent.contextMenu(screen.getByText('Alpha'))

		await waitFor(() => {
			expect(getMenuItemLabels(getLastMenu()!)).toEqual([
				'Open folder',
				'Rename',
				'Delete',
			])
		})

		await user.click(within(getLastMenu()!).getByRole('menuitem', { name: 'Rename' }))
		expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()

		fireEvent.contextMenu(screen.getByText('Beta'))

		await waitFor(() => {
			expect(getMenuItemLabels(getLastMenu()!)).toEqual([
				'Open folder',
				'Rename',
			])
		})

		expect(
			within(getLastMenu()!).queryByRole('menuitem', { name: 'Delete' })
		).not.toBeInTheDocument()
	})

	it('opens a chat from the collection chat row context menu', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()

		render(<CollectionsModal open onOpenChange={onOpenChange} />)

		await user.click(screen.getByText('Alpha'))
		fireEvent.contextMenu(await screen.findByText('Alpha planning'))

		await waitFor(() => {
			expect(getMenuItemLabels(getLastMenu()!)).toEqual([
				'Open chat',
				'Move to...',
				'Delete',
			])
		})

		await user.click(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Open chat' })
		)

		expect(mockRouterReplace).toHaveBeenCalledWith('/chat?c=chat-1', {
			scroll: false,
		})
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it('disables moving a chat into the folder that is already open', async () => {
		const user = userEvent.setup()

		render(<CollectionsModal open onOpenChange={vi.fn()} />)

		await user.click(screen.getByText('Alpha'))
		fireEvent.contextMenu(await screen.findByText('Alpha planning'))

		await user.hover(
			within(getLastMenu()!).getByRole('menuitem', { name: 'Move to...' })
		)

		await waitFor(() => {
			expect(screen.getAllByRole('menu').length).toBeGreaterThan(1)
		})

		const submenu = getLastMenu()!
		expect(
			within(submenu).getByRole('menuitem', { name: 'Alpha' })
		).toHaveAttribute('data-disabled')
		expect(
			within(submenu).getByRole('menuitem', { name: 'Uncategorized' })
		).not.toHaveAttribute('data-disabled')
		expect(
			within(submenu).getByRole('menuitem', { name: 'Beta' })
		).not.toHaveAttribute('data-disabled')
	})
})
