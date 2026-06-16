import { ChatArea } from '@/components/chat/chat-area'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockSendMessage = vi.hoisted(() => vi.fn())
const mockInvalidateConversations = vi.hoisted(() => vi.fn())
const mockUseConversationLoader = vi.hoisted(() => vi.fn())
const mockUseChatOptions = vi.hoisted(() => ({
	current: null as {
		onConversationCreated?: (_conversationId: string) => void
	} | null,
}))
const mockMessages = [
	{
		id: 'user-1',
		role: 'user' as const,
		content: 'Hello',
		createdAt: new Date('2026-04-08T10:00:00.000Z'),
	},
	{
		id: 'assistant-1',
		role: 'assistant' as const,
		content: 'Hi there',
		model: 'gpt-5',
		parentMessageId: 'user-1',
		createdAt: new Date('2026-04-08T10:01:00.000Z'),
	},
]
const mockUseChatState = vi.hoisted(() => ({
	messages: [] as typeof mockMessages,
	isStreaming: false,
	error: null as string | null,
	conversationId: 'conversation-1' as string | null,
}))
const mockAuthState = vi.hoisted(() => ({
	user: {
		id: 'user-1',
		name: 'Test User',
		email: 'test@example.com',
	} as { id: string; name: string; email: string } | null,
}))
const mockDisplayedMessagesState = vi.hoisted(() => ({
	displayedMessages: [] as Array<{
		id: string
		role: 'user' | 'assistant' | 'system'
		content: string
		model?: string
		parentMessageId?: string
		createdAt: Date
	}>,
}))
const mockSelectedConversationIdState = vi.hoisted(() => ({
	selectedConversationId: null as string | null,
}))

vi.mock('next/navigation', () => ({
	useRouter: () => ({
		replace: mockRouterReplace,
	}),
}))

vi.mock('next/dynamic', () => ({
	default: () => {
		return function DynamicComponent(props: Record<string, unknown>) {
			const testId = 'showMinimap' in props ? 'graph-map' : 'graph-inspector'
			return <div data-testid={testId} />
		}
	},
}))

vi.mock('@/contexts/auth-context', () => ({
	useAuth: () => mockAuthState,
}))

vi.mock('@/components/chat/chat-ui-provider', () => ({
	useChatUI: () => ({
		startTitleGeneration: vi.fn(),
		finishTitleGeneration: vi.fn(),
	}),
}))

vi.mock('@/hooks/use-chat', () => ({
	useChat: (options: {
		onConversationCreated?: (_conversationId: string) => void
	}) => {
		mockUseChatOptions.current = options
		return {
			messages: mockUseChatState.messages,
			isStreaming: mockUseChatState.isStreaming,
			error: mockUseChatState.error,
			conversationId: mockUseChatState.conversationId,
			sendMessage: mockSendMessage,
			regenerate: vi.fn(),
			editAndRegenerate: vi.fn(),
			stopGeneration: vi.fn(),
			clearMessages: vi.fn(),
			loadConversation: vi.fn(),
		}
	},
}))

vi.mock('@/hooks/use-conversations', () => ({
	useConversations: () => ({
		invalidateConversations: mockInvalidateConversations,
		invalidateConversationList: mockInvalidateConversations,
		generateTitle: vi.fn(),
		updateConversation: vi.fn(),
	}),
	useConversation: () => ({
		data: {
			title: 'Test Conversation',
		},
	}),
}))

vi.mock('@/hooks/use-skills', () => ({
	activeSkillFromInstalled: vi.fn(),
	useConversationSkills: () => ({
		data: [],
		isLoading: false,
	}),
	useSkillActions: () => ({
		unbindConversationSkill: vi.fn(),
	}),
}))

vi.mock('@/hooks/use-message-tree', () => ({
	useMessageTree: () => ({
		getSiblings: () => [],
		getSiblingIndex: () => 1,
		navigateSibling: vi.fn(),
		getActivePath: () => mockDisplayedMessagesState.displayedMessages,
		getAncestorPath: (
			messages: typeof mockMessages,
			messageId: string
		): typeof mockMessages => {
			const displayedMessages = mockDisplayedMessagesState.displayedMessages
			const sourceMessages =
				displayedMessages.length > 0 ? displayedMessages : messages
			const messageIndex = sourceMessages.findIndex(
				(message) => message.id === messageId
			)

			return messageIndex >= 0
				? (sourceMessages.slice(0, messageIndex + 1) as typeof mockMessages)
				: (sourceMessages as typeof mockMessages)
		},
	}),
}))

vi.mock('@/components/chat/use-conversation-loader', () => ({
	useConversationLoader: (
		options: Record<string, unknown>
	): { selectedConversationId: string | null } => {
		mockUseConversationLoader(options)
		return {
			selectedConversationId:
				mockSelectedConversationIdState.selectedConversationId,
		}
	},
}))

vi.mock('@/components/chat/chat-area/conversation-message-list', () => ({
	ConversationMessageList: ({
		onQuoteSelection,
		onScroll,
	}: {
		onQuoteSelection?: (_selection: {
			messageId: string
			text: string
			rect: DOMRect
		}) => void
		onScroll?: () => void
	}) => (
		<div data-testid="message-list">
			<button
				data-testid="trigger-quote-selection"
				onClick={() =>
					onQuoteSelection?.({
						messageId: 'assistant-1',
						text: 'Hi there',
						rect: {
							left: 400,
							top: 300,
							right: 460,
							bottom: 318,
							width: 60,
							height: 18,
						} as DOMRect,
					})
				}
			>
				Select quote
			</button>
			<button data-testid="scroll-message-list" onClick={onScroll}>
				Scroll
			</button>
		</div>
	),
}))

vi.mock('@/components/chat/chat-input', () => ({
	ChatInput: ({
		onSendMessage,
		branchContext,
		quoteInsertion,
		onFocus,
	}: {
		onSendMessage: (_content: string, _model: string) => Promise<void>
		branchContext?: {
			kind?: 'branch' | 'selected-reply'
			preview: string
		} | null
		quoteInsertion?: {
			text: string
		} | null
		onFocus?: () => void
	}) => (
		<div data-testid="chat-input">
			<div data-testid="branch-kind">{branchContext?.kind ?? ''}</div>
			<div data-testid="branch-preview">{branchContext?.preview ?? ''}</div>
			<div data-testid="quote-insertion">{quoteInsertion?.text ?? ''}</div>
			<button
				data-testid="send-chat-input"
				onClick={() => void onSendMessage('Next prompt', 'mistral-large')}
			>
				Send
			</button>
			<button data-testid="focus-chat-input" onClick={onFocus}>
				Focus
			</button>
		</div>
	),
}))

vi.mock('@/components/chat/ChatTOC', () => ({
	ChatTOC: () => <div data-testid="chat-toc" />,
}))

vi.mock('@/components/chat/sign-in-prompt-modal', () => ({
	SignInPromptModal: ({ open }: { open: boolean }) =>
		open ? <div data-testid="sign-in-modal" /> : null,
}))

vi.mock('@/components/chat/selective-share-modal', () => ({
	SelectiveShareModal: ({ open }: { open: boolean }) =>
		open ? <div data-testid="share-modal" /> : null,
}))

vi.mock('@/components/chat/conversation-export-dialog', () => ({
	ConversationExportDialog: ({ open }: { open: boolean }) =>
		open ? <div data-testid="export-modal" /> : null,
}))

describe('ChatArea', () => {
	let historyReplaceStateSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		window.history.replaceState(null, '', '/chat')
		historyReplaceStateSpy = vi.spyOn(window.history, 'replaceState')
		mockRouterReplace.mockReset()
		mockSendMessage.mockReset()
		mockInvalidateConversations.mockReset()
		mockUseConversationLoader.mockReset()
		mockUseChatOptions.current = null
		mockUseChatState.messages = [...mockMessages]
		mockUseChatState.isStreaming = false
		mockUseChatState.error = null
		mockUseChatState.conversationId = 'conversation-1'
		mockAuthState.user = {
			id: 'user-1',
			name: 'Test User',
			email: 'test@example.com',
		}
		mockDisplayedMessagesState.displayedMessages = [...mockMessages]
		mockSelectedConversationIdState.selectedConversationId = null
	})

	afterEach(() => {
		historyReplaceStateSpy.mockRestore()
	})

	it('opens export, share, and graph views from the top bar', async () => {
		const user = userEvent.setup()

		render(<ChatArea />)

		expect(screen.getByTestId('message-list')).toBeInTheDocument()
		expect(screen.getByTestId('chat-toc')).toBeInTheDocument()
		expect(screen.getByTestId('chat-input')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /export/i }))
		expect(screen.getByTestId('export-modal')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /share/i }))
		expect(screen.getByTestId('share-modal')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /fork/i }))
		expect(screen.getByTestId('graph-map')).toBeInTheDocument()
		expect(screen.queryByTestId('message-list')).not.toBeInTheDocument()
		expect(screen.queryByTestId('chat-toc')).not.toBeInTheDocument()
		expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
	})

	it('opens the sign-in prompt when guests try to share', async () => {
		mockAuthState.user = null
		const user = userEvent.setup()

		render(<ChatArea />)

		await user.click(screen.getByRole('button', { name: /share/i }))

		expect(screen.getByTestId('sign-in-modal')).toBeInTheDocument()
		expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
	})

	it('continues from the currently displayed leaf by default', async () => {
		const user = userEvent.setup()

		render(<ChatArea />)

		await user.click(screen.getByTestId('send-chat-input'))

		expect(mockSendMessage).toHaveBeenCalledWith(
			'Next prompt',
			'mistral-large',
			'assistant-1',
			[
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there' },
			],
			[],
			[],
			[],
			[]
		)
	})

	it('continues from the selected version when another branch is active', async () => {
		mockDisplayedMessagesState.displayedMessages = [
			{
				id: 'user-1',
				role: 'user',
				content: 'Hello',
				createdAt: new Date('2026-04-08T10:00:00.000Z'),
			},
			{
				id: 'assistant-2',
				role: 'assistant',
				content: 'Alternative branch',
				model: 'gpt-5',
				parentMessageId: 'user-1',
				createdAt: new Date('2026-04-08T10:02:00.000Z'),
			},
		]
		const user = userEvent.setup()

		render(<ChatArea />)

		await user.click(screen.getByTestId('send-chat-input'))

		expect(mockSendMessage).toHaveBeenCalledWith(
			'Next prompt',
			'mistral-large',
			'assistant-2',
			[
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Alternative branch' },
			],
			[],
			[],
			[],
			[]
		)
	})

	it('uses selected text reply context as the next message parent', async () => {
		mockDisplayedMessagesState.displayedMessages = [
			{
				id: 'user-1',
				role: 'user',
				content: 'Hello',
				createdAt: new Date('2026-04-08T10:00:00.000Z'),
			},
			{
				id: 'assistant-1',
				role: 'assistant',
				content: 'Hi there',
				model: 'gpt-5',
				parentMessageId: 'user-1',
				createdAt: new Date('2026-04-08T10:01:00.000Z'),
			},
			{
				id: 'user-2',
				role: 'user',
				content: 'Tell me more',
				parentMessageId: 'assistant-1',
				createdAt: new Date('2026-04-08T10:02:00.000Z'),
			},
			{
				id: 'assistant-2',
				role: 'assistant',
				content: 'More detail',
				model: 'gpt-5',
				parentMessageId: 'user-2',
				createdAt: new Date('2026-04-08T10:03:00.000Z'),
			},
		]
		const user = userEvent.setup()

		render(<ChatArea />)

		await user.click(screen.getByTestId('trigger-quote-selection'))
		expect(
			screen.getByRole('button', { name: /reply to selection/i })
		).toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: /reply to selection/i })
		)

		expect(screen.getByTestId('branch-kind')).toHaveTextContent(
			'selected-reply'
		)
		expect(screen.getByTestId('branch-preview')).toHaveTextContent('Hi there')
		expect(screen.getByTestId('quote-insertion')).toHaveTextContent('Hi there')

		await user.click(screen.getByTestId('send-chat-input'))

		expect(mockSendMessage).toHaveBeenCalledWith(
			'Next prompt',
			'mistral-large',
			'assistant-1',
			[
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there' },
			],
			[],
			[],
			[],
			[]
		)
	})

	it('uses native history replacement and keeps the pending conversation id until URL sync completes', async () => {
		mockUseChatState.isStreaming = true
		mockUseChatState.conversationId = null

		const { rerender } = render(<ChatArea />)

		expect(mockUseConversationLoader).toHaveBeenLastCalledWith({
			conversationId: null,
			loadConversation: expect.any(Function),
			clearMessages: expect.any(Function),
			isStreaming: true,
			suppressLoadConversationId: null,
		})

		mockUseChatState.conversationId = 'conversation-new'
		act(() => {
			mockUseChatOptions.current?.onConversationCreated?.('conversation-new')
		})

		expect(historyReplaceStateSpy).toHaveBeenLastCalledWith(
			null,
			'',
			'/chat?c=conversation-new'
		)
		expect(mockRouterReplace).not.toHaveBeenCalled()
		expect(mockUseConversationLoader).toHaveBeenLastCalledWith({
			conversationId: 'conversation-new',
			loadConversation: expect.any(Function),
			clearMessages: expect.any(Function),
			isStreaming: true,
			suppressLoadConversationId: 'conversation-new',
		})

		mockUseChatState.isStreaming = false
		rerender(<ChatArea />)

		expect(mockUseConversationLoader).toHaveBeenLastCalledWith({
			conversationId: 'conversation-new',
			loadConversation: expect.any(Function),
			clearMessages: expect.any(Function),
			isStreaming: false,
			suppressLoadConversationId: 'conversation-new',
		})

		mockSelectedConversationIdState.selectedConversationId = 'conversation-new'
		rerender(<ChatArea />)

		await waitFor(() => {
			expect(mockUseConversationLoader).toHaveBeenLastCalledWith({
				conversationId: 'conversation-new',
				loadConversation: expect.any(Function),
				clearMessages: expect.any(Function),
				isStreaming: false,
				suppressLoadConversationId: null,
			})
		})
	})

	it('invalidates conversations only when streaming finishes', async () => {
		const { rerender } = render(<ChatArea />)

		expect(mockInvalidateConversations).not.toHaveBeenCalled()

		rerender(<ChatArea />)
		expect(mockInvalidateConversations).not.toHaveBeenCalled()

		mockUseChatState.isStreaming = true
		rerender(<ChatArea />)
		expect(mockInvalidateConversations).not.toHaveBeenCalled()

		mockUseChatState.isStreaming = false
		rerender(<ChatArea />)

		await waitFor(() => {
			expect(mockInvalidateConversations).toHaveBeenCalledTimes(1)
		})

		rerender(<ChatArea />)
		expect(mockInvalidateConversations).toHaveBeenCalledTimes(1)
	})
})
