import { ChatArea } from '@/components/chat/chat-area'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterReplace = vi.hoisted(() => vi.fn())
const mockLogout = vi.hoisted(() => vi.fn())
const mockSelectedConversationIdState = vi.hoisted(() => ({
	selectedConversationId: null as string | null,
}))
const navigateSiblingMock = vi.hoisted(() => vi.fn())

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
	useAuth: () => ({
		user: {
			id: 'user-1',
			name: 'Test User',
			email: 'test@example.com',
		},
		logout: mockLogout,
	}),
}))

vi.mock('@/components/chat/chat-ui-provider', () => ({
	useChatUI: () => ({
		startTitleGeneration: vi.fn(),
		finishTitleGeneration: vi.fn(),
	}),
}))

vi.mock('@/hooks/use-conversations', () => ({
	useConversations: () => ({
		invalidateConversations: vi.fn(),
		invalidateConversationList: vi.fn(),
		generateTitle: vi.fn(),
		updateConversation: vi.fn(),
	}),
	useConversation: () => ({
		data: {
			title: 'Queued Conversation',
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

vi.mock('@/components/chat/use-conversation-loader', () => ({
	useConversationLoader: () => ({
		selectedConversationId:
			mockSelectedConversationIdState.selectedConversationId,
	}),
}))

vi.mock('@/hooks/use-message-tree', () => ({
	useMessageTree: () => ({
		getSiblings: (message: { id: string; role: string }) =>
			message.role === 'assistant'
				? [message, { ...message, id: `${message.id}-alt` }]
				: [message],
		getSiblingIndex: () => 1,
		navigateSibling: navigateSiblingMock,
		getActivePath: (messages: unknown[]) => messages,
		getAncestorPath: (
			messages: Array<{
				id: string
				parentMessageId?: string | null
			}>,
			branchFromId: string
		) => {
			const messageById = new Map(
				messages.map((message) => [message.id, message])
			)
			const path: typeof messages = []
			let currentId: string | null = branchFromId

			while (currentId) {
				const currentMessage = messageById.get(currentId)
				if (!currentMessage) break
				path.unshift(currentMessage)
				currentId = currentMessage.parentMessageId ?? null
			}

			return path
		},
	}),
}))

vi.mock('@/components/chat/chat-area/conversation-message-list', () => ({
	ConversationMessageList: ({
		displayedMessages,
		getSiblingNav,
		disableMutatingActions,
	}: {
		displayedMessages: Array<{
			id: string
			role: 'user' | 'assistant' | 'system'
			parentMessageId?: string | null
		}>
		getSiblingNav: (_message: {
			id: string
			role: 'user' | 'assistant' | 'system'
			parentMessageId?: string | null
		}) =>
			| {
					onNext: () => void
					disabled?: boolean
			  }
			| undefined
		disableMutatingActions?: boolean
	}) => {
		const assistantMessage = displayedMessages.find(
			(message) => message.role === 'assistant'
		)
		const siblingNav = assistantMessage
			? getSiblingNav(assistantMessage)
			: undefined

		return (
			<div
				data-testid="message-list"
				data-disabled={disableMutatingActions ? 'true' : 'false'}
			>
				<button disabled={siblingNav?.disabled} onClick={siblingNav?.onNext}>
					Next version
				</button>
			</div>
		)
	},
}))

vi.mock('@/components/chat/ChatTOC', () => ({
	ChatTOC: () => <div data-testid="chat-toc" />,
}))

vi.mock('@/components/chat/sign-in-prompt-modal', () => ({
	SignInPromptModal: () => null,
}))

vi.mock('@/components/chat/selective-share-modal', () => ({
	SelectiveShareModal: () => null,
}))

vi.mock('@/components/chat/conversation-export-dialog', () => ({
	ConversationExportDialog: () => null,
}))

vi.mock('@/components/chat/skill-picker', () => ({
	SkillPicker: () => null,
}))

function QueryWrapper({ children }: { children: ReactNode }) {
	const [queryClient] = useState(
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

function renderChatArea() {
	return render(<ChatArea />, { wrapper: QueryWrapper })
}

function createControlledStreamResponse() {
	let controller: ReadableStreamDefaultController<Uint8Array>

	const response = new Response(
		new ReadableStream({
			start(streamController) {
				controller = streamController
			},
		}),
		{
			status: 200,
			headers: {
				'Content-Type': 'text/event-stream',
			},
		}
	)

	return {
		response,
		emit(event: Record<string, unknown>) {
			controller.enqueue(
				new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
			)
		},
		close() {
			controller.close()
		},
	}
}

describe('ChatArea queue behavior', () => {
	const fetchMock = vi.fn()
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
		mockRouterReplace.mockReset()
		mockLogout.mockReset()
		navigateSiblingMock.mockReset()
		mockSelectedConversationIdState.selectedConversationId = null
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		localStorage.clear()
		window.history.replaceState(null, '', '/chat')
	})

	afterEach(() => {
		consoleErrorSpy.mockRestore()
	})

	it('queues extra prompts while streaming and carries forward the latest queued path', async () => {
		const user = userEvent.setup()
		const firstStream = createControlledStreamResponse()
		const secondStream = createControlledStreamResponse()
		const thirdStream = createControlledStreamResponse()

		fetchMock
			.mockResolvedValueOnce(firstStream.response)
			.mockResolvedValueOnce(secondStream.response)
			.mockResolvedValueOnce(thirdStream.response)

		renderChatArea()

		const textarea = screen.getByPlaceholderText('Ask anything...')
		await user.type(textarea, 'First prompt')
		await user.keyboard('{Enter}')

		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /stop generating/i })
			).toBeInTheDocument()
		})

		await user.type(textarea, 'Second prompt')
		await user.keyboard('{Enter}')
		await user.type(textarea, 'Third prompt')
		await user.keyboard('{Enter}')

		expect(screen.getByText('Queued 2')).toBeInTheDocument()
		expect(screen.getByTestId('message-list')).toHaveAttribute(
			'data-disabled',
			'true'
		)
		expect(screen.getByRole('button', { name: 'Next version' })).toBeDisabled()

		firstStream.emit({ type: 'conversation', conversationId: 'conversation-1' })
		firstStream.emit({ type: 'messageId', userMessageId: 'user-1' })
		firstStream.emit({ type: 'content', content: 'First answer' })
		firstStream.emit({
			type: 'done',
			assistantMessageId: 'assistant-1',
			usage: { promptTokens: 2, completionTokens: 3 },
		})
		firstStream.close()

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2)
		})

		expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toMatchObject(
			{
				message: 'Second prompt',
				parentMessageId: 'assistant-1',
				history: [
					{ role: 'user', content: 'First prompt' },
					{ role: 'assistant', content: 'First answer' },
				],
			}
		)

		secondStream.emit({ type: 'messageId', userMessageId: 'user-2' })
		secondStream.emit({ type: 'content', content: 'Second answer' })
		secondStream.emit({
			type: 'done',
			assistantMessageId: 'assistant-2',
			usage: { promptTokens: 4, completionTokens: 5 },
		})
		secondStream.close()

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(3)
		})

		expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toMatchObject(
			{
				message: 'Third prompt',
				parentMessageId: 'assistant-2',
				history: [
					{ role: 'user', content: 'First prompt' },
					{ role: 'assistant', content: 'First answer' },
					{ role: 'user', content: 'Second prompt' },
					{ role: 'assistant', content: 'Second answer' },
				],
			}
		)

		thirdStream.emit({ type: 'messageId', userMessageId: 'user-3' })
		thirdStream.emit({ type: 'content', content: 'Third answer' })
		thirdStream.emit({
			type: 'done',
			assistantMessageId: 'assistant-3',
			usage: { promptTokens: 6, completionTokens: 7 },
		})
		thirdStream.close()

		await waitFor(() => {
			expect(screen.queryByText(/Queued \d+/)).not.toBeInTheDocument()
		})
		expect(screen.getByTestId('message-list')).toHaveAttribute(
			'data-disabled',
			'false'
		)
	})

	it('clears the queue when the user stops the current response', async () => {
		const user = userEvent.setup()

		fetchMock.mockImplementationOnce((_, init) => {
			return new Promise((_, reject) => {
				const abortError = new Error('Aborted')
				abortError.name = 'AbortError'
				init?.signal?.addEventListener('abort', () => reject(abortError))
			})
		})

		renderChatArea()

		const textarea = screen.getByPlaceholderText('Ask anything...')
		await user.type(textarea, 'First prompt')
		await user.keyboard('{Enter}')
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /stop generating/i })
			).toBeInTheDocument()
		})

		await user.type(textarea, 'Second prompt')
		await user.keyboard('{Enter}')
		expect(screen.getByText('Queued 1')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /stop generating/i }))

		await waitFor(() => {
			expect(screen.queryByText(/Queued \d+/)).not.toBeInTheDocument()
		})
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('halts the queue after an error and resumes from the last successful assistant', async () => {
		const user = userEvent.setup()
		const firstStream = createControlledStreamResponse()
		const thirdStream = createControlledStreamResponse()

		fetchMock
			.mockResolvedValueOnce(firstStream.response)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'Queued send failed' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				})
			)
			.mockResolvedValueOnce(thirdStream.response)

		renderChatArea()

		const textarea = screen.getByPlaceholderText('Ask anything...')
		await user.type(textarea, 'First prompt')
		await user.keyboard('{Enter}')
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /stop generating/i })
			).toBeInTheDocument()
		})

		await user.type(textarea, 'Second prompt')
		await user.keyboard('{Enter}')
		await user.type(textarea, 'Third prompt')
		await user.keyboard('{Enter}')

		firstStream.emit({ type: 'conversation', conversationId: 'conversation-1' })
		firstStream.emit({ type: 'messageId', userMessageId: 'user-1' })
		firstStream.emit({ type: 'content', content: 'First answer' })
		firstStream.emit({
			type: 'done',
			assistantMessageId: 'assistant-1',
			usage: { promptTokens: 2, completionTokens: 3 },
		})
		firstStream.close()

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2)
		})

		await waitFor(() => {
			expect(screen.getByText('Queued 1')).toBeInTheDocument()
			expect(screen.getByText('Paused after an error')).toBeInTheDocument()
		})

		await user.click(screen.getByRole('button', { name: /resume/i }))

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(3)
		})

		expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toMatchObject(
			{
				message: 'Third prompt',
				parentMessageId: 'assistant-1',
				history: [
					{ role: 'user', content: 'First prompt' },
					{ role: 'assistant', content: 'First answer' },
				],
			}
		)

		thirdStream.emit({ type: 'messageId', userMessageId: 'user-3' })
		thirdStream.emit({ type: 'content', content: 'Third answer' })
		thirdStream.emit({
			type: 'done',
			assistantMessageId: 'assistant-3',
			usage: { promptTokens: 4, completionTokens: 5 },
		})
		thirdStream.close()

		await waitFor(() => {
			expect(screen.queryByText(/Queued \d+/)).not.toBeInTheDocument()
		})
	})

	it('clears queued prompts when the selected conversation changes', async () => {
		const user = userEvent.setup()

		fetchMock.mockImplementationOnce((_, init) => {
			return new Promise((_, reject) => {
				const abortError = new Error('Aborted')
				abortError.name = 'AbortError'
				init?.signal?.addEventListener('abort', () => reject(abortError))
			})
		})

		const { rerender } = renderChatArea()

		const textarea = screen.getByPlaceholderText('Ask anything...')
		await user.type(textarea, 'First prompt')
		await user.keyboard('{Enter}')
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /stop generating/i })
			).toBeInTheDocument()
		})

		await user.type(textarea, 'Second prompt')
		await user.keyboard('{Enter}')

		expect(screen.getByText('Queued 1')).toBeInTheDocument()
		expect(screen.getByTestId('message-list')).toHaveAttribute(
			'data-disabled',
			'true'
		)

		mockSelectedConversationIdState.selectedConversationId =
			'conversation-other'
		rerender(<ChatArea />)

		await waitFor(() => {
			expect(screen.queryByText(/Queued \d+/)).not.toBeInTheDocument()
		})
		expect(screen.getByTestId('message-list')).toHaveAttribute(
			'data-disabled',
			'false'
		)
	})
})
