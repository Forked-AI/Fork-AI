import { CollectionsModal } from '@/components/chat/collections-modal'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockMutateAsync = vi.fn()
const mockUseConversations = vi.fn()
const mockUpdateConversation = vi.fn()
const mockDeleteConversation = vi.fn()
const mockInvalidateConversations = vi.fn()
const mockToast = vi.fn()

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
			conversations: 150,
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
			conversations: 12,
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

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({
		toast: mockToast,
	}),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({
		children,
		onSelect,
		disabled,
		className,
	}: {
		children: React.ReactNode
		onSelect?: () => void
		disabled?: boolean
		className?: string
	}) => (
		<button
			className={className}
			disabled={disabled}
			onClick={() => onSelect?.()}
			type="button"
		>
			{children}
		</button>
	),
	DropdownMenuSeparator: () => <div />,
	DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}))

describe('CollectionsModal', () => {
	beforeEach(() => {
		mockRouterReplace.mockReset()
		mockMutateAsync.mockReset()
		mockUseConversations.mockReset()
		mockUpdateConversation.mockReset()
		mockDeleteConversation.mockReset()
		mockInvalidateConversations.mockReset()
		mockToast.mockReset()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('shows uncategorized counts from pagination totals', () => {
		mockUseConversations.mockImplementation((options?: { collectionId?: string | null }) => {
			if (options?.collectionId === null) {
				return {
					conversations: Array.from({ length: 100 }, (_, index) => ({
						id: `uncat-${index}`,
						title: `Uncategorized ${index + 1}`,
						messageCount: 1,
						lastMessage: null,
						collection: null,
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					})),
					pagination: {
						page: 1,
						limit: 100,
						total: 250,
						totalPages: 3,
						hasMore: true,
					},
					isLoading: false,
					updateConversation: mockUpdateConversation,
					deleteConversation: mockDeleteConversation,
					invalidateConversations: mockInvalidateConversations,
				}
			}

			return {
				conversations: [],
				pagination: undefined,
				isLoading: false,
				updateConversation: mockUpdateConversation,
				deleteConversation: mockDeleteConversation,
				invalidateConversations: mockInvalidateConversations,
			}
		})

		render(<CollectionsModal open onOpenChange={vi.fn()} />)

		expect(screen.getByText('250 chats')).toBeInTheDocument()
	})

	it('can navigate to page 2 for large folders', async () => {
		const user = userEvent.setup()

		mockUseConversations.mockImplementation((options?: {
			collectionId?: string | null
			page?: number
		}) => {
			if (options?.collectionId === 'folder-1') {
				const page = options.page ?? 1
				const pageChats =
					page === 1
						? [
								{ id: 'chat-1', title: 'Chat 1' },
								{ id: 'chat-2', title: 'Chat 2' },
							]
						: [{ id: 'chat-101', title: 'Chat 101' }]

				return {
					conversations: pageChats.map((chat) => ({
						id: chat.id,
						title: chat.title,
						messageCount: 1,
						lastMessage: null,
						collection: {
							id: 'folder-1',
							name: 'Alpha',
							color: '#57FCFF',
						},
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					})),
					pagination: {
						page,
						limit: 100,
						total: 150,
						totalPages: 2,
						hasMore: page < 2,
					},
					isLoading: false,
					updateConversation: mockUpdateConversation,
					deleteConversation: mockDeleteConversation,
					invalidateConversations: mockInvalidateConversations,
				}
			}

			return {
				conversations: [],
				pagination: {
					page: 1,
					limit: 100,
					total: 0,
					totalPages: 0,
					hasMore: false,
				},
				isLoading: false,
				updateConversation: mockUpdateConversation,
				deleteConversation: mockDeleteConversation,
				invalidateConversations: mockInvalidateConversations,
			}
		})

		render(<CollectionsModal open onOpenChange={vi.fn()} />)

		await user.click(screen.getByText('Alpha'))

		expect(screen.getByText('Chat 1')).toBeInTheDocument()
		expect(screen.getByText('Page 1 of 2 • 150 chats')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /next/i }))

		await waitFor(() => {
			expect(screen.getByText('Chat 101')).toBeInTheDocument()
		})

		expect(screen.queryByText('Chat 1')).not.toBeInTheDocument()
		expect(screen.getByText('Page 2 of 2 • 150 chats')).toBeInTheDocument()
	})

	it('opens a chat using router navigation and closes the modal', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()

		mockUseConversations.mockImplementation((options?: {
			collectionId?: string | null
			page?: number
		}) => {
			if (options?.collectionId === 'folder-1') {
				return {
					conversations: [
						{
							id: 'chat-1',
							title: 'Chat 1',
							messageCount: 3,
							lastMessage: null,
							collection: {
								id: 'folder-1',
								name: 'Alpha',
								color: '#57FCFF',
							},
							createdAt: '2025-01-01T00:00:00.000Z',
							updatedAt: '2025-01-01T00:00:00.000Z',
						},
					],
					pagination: {
						page: 1,
						limit: 100,
						total: 1,
						totalPages: 1,
						hasMore: false,
					},
					isLoading: false,
					updateConversation: mockUpdateConversation,
					deleteConversation: mockDeleteConversation,
					invalidateConversations: mockInvalidateConversations,
				}
			}

			return {
				conversations: [],
				pagination: {
					page: 1,
					limit: 100,
					total: 0,
					totalPages: 0,
					hasMore: false,
				},
				isLoading: false,
				updateConversation: mockUpdateConversation,
				deleteConversation: mockDeleteConversation,
				invalidateConversations: mockInvalidateConversations,
			}
		})

		render(<CollectionsModal open onOpenChange={onOpenChange} />)

		await user.click(screen.getByText('Alpha'))
		await user.click(await screen.findByText('Open chat'))

		expect(mockRouterReplace).toHaveBeenCalledWith('/chat?c=chat-1', {
			scroll: false,
		})
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it('moves a chat to another folder from the move menu', async () => {
		const user = userEvent.setup()

		mockUpdateConversation.mockResolvedValue({
			conversation: {
				id: 'chat-1',
			},
		})

		mockUseConversations.mockImplementation((options?: {
			collectionId?: string | null
			page?: number
		}) => {
			if (options?.collectionId === 'folder-1') {
				return {
					conversations: [
						{
							id: 'chat-1',
							title: 'Chat 1',
							messageCount: 3,
							lastMessage: null,
							collection: {
								id: 'folder-1',
								name: 'Alpha',
								color: '#57FCFF',
							},
							createdAt: '2025-01-01T00:00:00.000Z',
							updatedAt: '2025-01-01T00:00:00.000Z',
						},
					],
					pagination: {
						page: 1,
						limit: 100,
						total: 1,
						totalPages: 1,
						hasMore: false,
					},
					isLoading: false,
					updateConversation: mockUpdateConversation,
					deleteConversation: mockDeleteConversation,
					invalidateConversations: mockInvalidateConversations,
				}
			}

			return {
				conversations: [],
				pagination: {
					page: 1,
					limit: 100,
					total: 0,
					totalPages: 0,
					hasMore: false,
				},
				isLoading: false,
				updateConversation: mockUpdateConversation,
				deleteConversation: mockDeleteConversation,
				invalidateConversations: mockInvalidateConversations,
			}
		})

		render(<CollectionsModal open onOpenChange={vi.fn()} />)

		await user.click(screen.getByText('Alpha'))
		await user.click(await screen.findByText('Beta'))

		await waitFor(() => {
			expect(mockUpdateConversation).toHaveBeenCalledWith({
				id: 'chat-1',
				collectionId: 'folder-2',
			})
		})

		expect(mockToast).toHaveBeenCalledWith({
			title: 'Chat moved',
			description: 'Moved to Beta.',
		})
	})

	it('shows a toast when creating a folder fails', async () => {
		const user = userEvent.setup()
		const consoleErrorSpy = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined)

		mockMutateAsync.mockRejectedValueOnce(new Error('Folder name already exists'))

		mockUseConversations.mockReturnValue({
			conversations: [],
			pagination: {
				page: 1,
				limit: 100,
				total: 0,
				totalPages: 0,
				hasMore: false,
			},
			isLoading: false,
			updateConversation: mockUpdateConversation,
			deleteConversation: mockDeleteConversation,
			invalidateConversations: mockInvalidateConversations,
		})

		render(<CollectionsModal open onOpenChange={vi.fn()} />)

		await user.type(
			screen.getByPlaceholderText('New folder name'),
			'Duplicate'
		)
		await user.click(screen.getByRole('button', { name: /add/i }))

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith({
				title: 'Failed to create folder',
				description: 'Folder name already exists',
				variant: 'destructive',
			})
		})

		consoleErrorSpy.mockRestore()
	})
})
