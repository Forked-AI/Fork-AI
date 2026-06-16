import {
	buildLocalHistorySnapshot,
	useChat,
	type Message,
	type UseChatOptions,
} from '@/hooks/use-chat'
import {
	clearConversationDetailCache,
	conversationDetailQueryKey,
	type ConversationDetailPayload,
} from '@/lib/conversation-api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function createStreamResponse(chunks: string[]) {
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(new TextEncoder().encode(chunk))
				}
				controller.close()
			},
		}),
		{
			status: 200,
			headers: {
				'Content-Type': 'text/event-stream',
			},
		}
	)
}

function createMessage(overrides: Partial<Message>): Message {
	return {
		id: 'message-id',
		role: 'user',
		content: 'Message content',
		createdAt: new Date('2026-04-08T10:00:00.000Z'),
		...overrides,
	}
}

function createConversationDetail(
	overrides: Partial<ConversationDetailPayload> = {}
): ConversationDetailPayload {
	return {
		id: 'conversation-1',
		title: 'Cached conversation',
		messages: [
			{
				id: 'message-1',
				role: 'assistant',
				content: 'Cached reply',
				model: 'mistral-large',
				promptTokens: 3,
				completionTokens: 5,
				isError: false,
				createdAt: '2026-04-08T10:00:00.000Z',
				parentMessageId: null,
			},
		],
		...overrides,
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

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		)
	}
}

function renderUseChat(options: UseChatOptions = {}) {
	const queryClient = createQueryClient()
	const hook = renderHook(() => useChat(options), {
		wrapper: createWrapper(queryClient),
	})

	return {
		...hook,
		queryClient,
	}
}

describe('useChat', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		clearConversationDetailCache()
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	it('reconciles temp ids and parses fragmented SSE events', async () => {
		fetchMock.mockResolvedValue(
			createStreamResponse([
				'data: {"type":"conversation","conversationId":"conversation-1"}\n\n',
				'data: {"type":"messageId","userMessageId":"user-1"}\n\nda',
				'ta: {"type":"content","content":"Hel',
				'lo"}\n\ndata: {"type":"done","assistantMessageId":"assistant-1","usage":{"promptTokens":3,"completionTokens":5}}\n\n',
			])
		)
		const onConversationCreated = vi.fn()
		const { result } = renderUseChat({ onConversationCreated })

		let sendResult: Awaited<
			ReturnType<typeof result.current.sendMessage>
		> | null = null
		await act(async () => {
			sendResult = await result.current.sendMessage('Hello')
		})

		expect(onConversationCreated).toHaveBeenCalledWith('conversation-1')
		expect(sendResult).toEqual({
			conversationId: 'conversation-1',
			userMessageId: 'user-1',
			assistantMessageId: 'assistant-1',
			status: 'done',
		})
		expect(result.current.messages).toHaveLength(2)
		expect(result.current.messages[0]).toMatchObject({
			id: 'user-1',
			role: 'user',
			content: 'Hello',
		})
		expect(result.current.messages[1]).toMatchObject({
			id: 'assistant-1',
			role: 'assistant',
			content: 'Hello',
			isStreaming: false,
			promptTokens: 3,
			completionTokens: 5,
		})
		expect(result.current.isStreaming).toBe(false)
	})

	it('handles multiple SSE events delivered in one chunk', async () => {
		fetchMock.mockResolvedValue(
			createStreamResponse([
				'data: {"type":"messageId","userMessageId":"user-2"}\n\n' +
					'data: {"type":"content","content":"Hel"}\n\n' +
					'data: {"type":"content","content":"lo"}\n\n' +
					'data: {"type":"done","assistantMessageId":"assistant-2","usage":{"promptTokens":2,"completionTokens":4}}\n\n',
			])
		)
		const { result } = renderUseChat()

		await act(async () => {
			await result.current.sendMessage('Hello')
		})

		expect(result.current.messages[0]).toMatchObject({
			id: 'user-2',
			content: 'Hello',
		})
		expect(result.current.messages[1]).toMatchObject({
			id: 'assistant-2',
			content: 'Hello',
			isStreaming: false,
		})
	})

	it('keeps the temp assistant id when guest completion has no assistant id', async () => {
		fetchMock.mockResolvedValue(
			createStreamResponse([
				'data: {"type":"content","content":"Hi there"}\n\n' +
					'data: {"type":"done","usage":{"promptTokens":1,"completionTokens":2}}\n\n',
			])
		)
		const { result } = renderUseChat()

		await act(async () => {
			await result.current.sendMessage('Hello guest')
		})

		expect(result.current.messages[1]).toMatchObject({
			role: 'assistant',
			content: 'Hi there',
			isStreaming: false,
		})
		expect(result.current.messages[1]?.id).toMatch(/^temp-assistant-/)
	})

	it('returns a stopped status when the active request is aborted', async () => {
		fetchMock.mockImplementation((_, init) => {
			return new Promise((_, reject) => {
				const abortError = new Error('Aborted')
				abortError.name = 'AbortError'
				init?.signal?.addEventListener('abort', () => reject(abortError))
			})
		})
		const { result } = renderUseChat()

		let sendPromise: Promise<
			Awaited<ReturnType<typeof result.current.sendMessage>>
		> | null = null
		act(() => {
			sendPromise = result.current.sendMessage('Stop me')
		})
		act(() => {
			result.current.stopGeneration()
		})

		let sendResult: Awaited<
			ReturnType<typeof result.current.sendMessage>
		> | null = null
		await act(async () => {
			sendResult = await sendPromise!
		})

		expect(sendResult).toMatchObject({
			status: 'stopped',
			userMessageId: expect.stringMatching(/^temp-user-/),
			assistantMessageId: expect.stringMatching(/^temp-assistant-/),
		})
	})

	it('returns an error status when the request fails before streaming starts', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to send message' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			})
		)
		const { result } = renderUseChat()

		let sendResult: Awaited<
			ReturnType<typeof result.current.sendMessage>
		> | null = null
		await act(async () => {
			sendResult = await result.current.sendMessage('Broken request')
		})

		expect(sendResult).toMatchObject({
			status: 'error',
			userMessageId: expect.stringMatching(/^temp-user-/),
			assistantMessageId: expect.stringMatching(/^temp-assistant-/),
		})
		expect(result.current.error).toBe('Failed to send message')
	})

	it('maps app-level HTTP 429 errors to actionable chat limit messaging', async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					error: 'Rate limit exceeded',
					errorCode: 'CHAT_RATE_LIMIT_EXCEEDED',
					retryAfter: 15,
				}),
				{
					status: 429,
					headers: { 'Content-Type': 'application/json' },
				}
			)
		)
		const { result } = renderUseChat()

		await act(async () => {
			await result.current.sendMessage('Too many requests')
		})

		expect(result.current.error).toBe(
			'Chat rate limit reached. Please retry in 15s.'
		)
		expect(result.current.messages[1]).toMatchObject({
			role: 'assistant',
			content: 'Chat rate limit reached. Please retry in 15s.',
			isError: true,
		})
	})

	it('maps provider 429 stream errors to actionable model limit messaging', async () => {
		fetchMock.mockResolvedValue(
			createStreamResponse([
				'data: {"type":"error","errorCode":"PROVIDER_RATE_LIMITED","providerStatusCode":429,"retryAfterSeconds":12}\n\n',
			])
		)
		const { result } = renderUseChat()

		let sendResult: Awaited<
			ReturnType<typeof result.current.sendMessage>
		> | null = null
		await act(async () => {
			sendResult = await result.current.sendMessage('Please respond')
		})

		expect(sendResult).toMatchObject({ status: 'error' })
		expect(result.current.error).toBe(
			'Model is currently rate-limited. Please retry in 12s.'
		)
		expect(result.current.messages[1]).toMatchObject({
			role: 'assistant',
			content: 'Model is currently rate-limited. Please retry in 12s.',
			isError: true,
		})
	})

	it('blocks duplicate sends while one request is already in flight', async () => {
		fetchMock.mockImplementation((_, init) => {
			return new Promise((_, reject) => {
				const abortError = new Error('Aborted')
				abortError.name = 'AbortError'
				init?.signal?.addEventListener('abort', () => reject(abortError))
			})
		})
		const { result } = renderUseChat()

		let firstSendPromise: Promise<
			Awaited<ReturnType<typeof result.current.sendMessage>>
		> | null = null
		act(() => {
			firstSendPromise = result.current.sendMessage('First request')
		})

		let secondSendResult: Awaited<
			ReturnType<typeof result.current.sendMessage>
		> | null = null
		await act(async () => {
			secondSendResult = await result.current.sendMessage('Second request')
		})

		expect(secondSendResult).toEqual({
			conversationId: null,
			userMessageId: null,
			assistantMessageId: null,
			status: 'error',
		})
		expect(fetchMock).toHaveBeenCalledTimes(1)

		act(() => {
			result.current.stopGeneration()
		})

		await act(async () => {
			await firstSendPromise
		})
	})

	it('regenerate sends a sibling branch request using the original parent', async () => {
		fetchMock.mockResolvedValue(
			createStreamResponse([
				'data: {"type":"done","assistantMessageId":"assistant-3","usage":{"promptTokens":1,"completionTokens":1}}\n\n',
			])
		)
		const { result } = renderUseChat()

		act(() => {
			result.current.setMessages([
				createMessage({
					id: 'user-1',
					role: 'user',
					content: 'Original prompt',
					createdAt: new Date('2026-04-08T10:00:00.000Z'),
				}),
				createMessage({
					id: 'assistant-1',
					role: 'assistant',
					content: 'Original reply',
					parentMessageId: 'user-1',
					model: 'mistral-large',
					createdAt: new Date('2026-04-08T10:01:00.000Z'),
				}),
			])
		})

		await act(async () => {
			await result.current.regenerate('assistant-1')
		})

		expect(fetchMock.mock.calls[0][0]).toBe(
			'/api/messages/assistant-1/retry'
		)
		const request = JSON.parse(fetchMock.mock.calls[0][1].body as string)
		expect(request).toMatchObject({
			model: 'mistral-large',
		})
		expect(request.message).toBeUndefined()
		expect(result.current.messages.filter((msg) => msg.role === 'user')).toHaveLength(1)
	})

	it('editAndRegenerate keeps edits as sibling branches', async () => {
		fetchMock.mockResolvedValue(
			createStreamResponse([
				'data: {"type":"done","assistantMessageId":"assistant-4","usage":{"promptTokens":1,"completionTokens":1}}\n\n',
			])
		)
		const { result } = renderUseChat()

		act(() => {
			result.current.setMessages([
				createMessage({
					id: 'user-1',
					role: 'user',
					content: 'Root prompt',
					createdAt: new Date('2026-04-08T10:00:00.000Z'),
				}),
				createMessage({
					id: 'assistant-1',
					role: 'assistant',
					content: 'Root reply',
					parentMessageId: 'user-1',
					createdAt: new Date('2026-04-08T10:01:00.000Z'),
				}),
				createMessage({
					id: 'user-2',
					role: 'user',
					content: 'Follow-up prompt',
					parentMessageId: 'assistant-1',
					createdAt: new Date('2026-04-08T10:02:00.000Z'),
				}),
				createMessage({
					id: 'assistant-2',
					role: 'assistant',
					content: 'Follow-up reply',
					parentMessageId: 'user-2',
					model: 'mistral-large',
					createdAt: new Date('2026-04-08T10:03:00.000Z'),
				}),
			])
		})

		await act(async () => {
			await result.current.editAndRegenerate('user-2', 'Edited follow-up')
		})

		const request = JSON.parse(fetchMock.mock.calls[0][1].body as string)
		expect(request.message).toBe('Edited follow-up')
		expect(request.parentMessageId).toBe('assistant-1')
		expect(request.history).toEqual([
			{ role: 'user', content: 'Root prompt' },
			{ role: 'assistant', content: 'Root reply' },
		])
	})

	it('loads cached conversation detail without calling the API', async () => {
		const cachedConversation = createConversationDetail({
			id: 'conversation-cached',
		})
		const { result, queryClient } = renderUseChat()
		queryClient.setQueryData(
			conversationDetailQueryKey('conversation-cached'),
			cachedConversation
		)

		await act(async () => {
			await result.current.loadConversation('conversation-cached')
		})

		expect(fetchMock).not.toHaveBeenCalled()
		expect(result.current.conversationId).toBe('conversation-cached')
		expect(result.current.messages[0]).toMatchObject({
			id: 'message-1',
			model: 'mistral-large',
			promptTokens: 3,
			completionTokens: 5,
			isError: false,
		})
		expect(result.current.messages[0]?.createdAt).toEqual(
			new Date('2026-04-08T10:00:00.000Z')
		)
	})

	it('fetches uncached conversation detail once and stores it in cache', async () => {
		const fetchedConversation = createConversationDetail({
			id: 'conversation-fetched',
		})
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ conversation: fetchedConversation }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		)
		const { result, queryClient } = renderUseChat()

		await act(async () => {
			await result.current.loadConversation('conversation-fetched')
		})

		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/conversations/conversation-fetched',
			{ credentials: 'include' }
		)
		expect(
			queryClient.getQueryData(
				conversationDetailQueryKey('conversation-fetched')
			)
		).toEqual(fetchedConversation)
	})

	it('reuses cached detail when the same conversation is loaded again', async () => {
		const fetchedConversation = createConversationDetail({
			id: 'conversation-repeat',
		})
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ conversation: fetchedConversation }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		)
		const { result } = renderUseChat()

		await act(async () => {
			await result.current.loadConversation('conversation-repeat')
		})
		await act(async () => {
			await result.current.loadConversation('conversation-repeat')
		})

		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('reuses cached detail when switching away and back to a conversation', async () => {
		const conversationA = createConversationDetail({
			id: 'conversation-a',
			title: 'Conversation A',
			messages: [
				{
					id: 'message-a',
					role: 'assistant',
					content: 'Cached A',
					createdAt: '2026-04-08T10:00:00.000Z',
				},
			],
		})
		const conversationB = createConversationDetail({
			id: 'conversation-b',
			title: 'Conversation B',
			messages: [
				{
					id: 'message-b',
					role: 'assistant',
					content: 'Cached B',
					createdAt: '2026-04-08T10:01:00.000Z',
				},
			],
		})
		fetchMock.mockImplementation((input: string) => {
			const conversation = input.endsWith('/conversation-a')
				? conversationA
				: conversationB

			return Promise.resolve(
				new Response(JSON.stringify({ conversation }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		})
		const { result } = renderUseChat()

		await act(async () => {
			await result.current.loadConversation('conversation-a')
		})
		await act(async () => {
			await result.current.loadConversation('conversation-b')
		})
		await act(async () => {
			await result.current.loadConversation('conversation-a')
		})

		expect(fetchMock).toHaveBeenCalledTimes(2)
		expect(result.current.conversationId).toBe('conversation-a')
		expect(result.current.messages[0]).toMatchObject({
			id: 'message-a',
			content: 'Cached A',
		})
	})

	it('buildLocalHistorySnapshot follows the selected parent chain', () => {
		const history = buildLocalHistorySnapshot(
			[
				createMessage({
					id: 'user-1',
					role: 'user',
					content: 'Root prompt',
					createdAt: new Date('2026-04-08T10:00:00.000Z'),
				}),
				createMessage({
					id: 'assistant-1',
					role: 'assistant',
					content: 'Root reply',
					parentMessageId: 'user-1',
					createdAt: new Date('2026-04-08T10:01:00.000Z'),
				}),
				createMessage({
					id: 'user-2',
					role: 'user',
					content: 'Branch prompt',
					parentMessageId: 'assistant-1',
					createdAt: new Date('2026-04-08T10:02:00.000Z'),
				}),
				createMessage({
					id: 'assistant-2',
					role: 'assistant',
					content: 'Branch reply',
					parentMessageId: 'user-2',
					createdAt: new Date('2026-04-08T10:03:00.000Z'),
				}),
				createMessage({
					id: 'assistant-alt',
					role: 'assistant',
					content: 'Alternate reply',
					parentMessageId: 'user-1',
					createdAt: new Date('2026-04-08T10:04:00.000Z'),
				}),
			],
			'assistant-2'
		)

		expect(history).toEqual([
			{ role: 'user', content: 'Root prompt' },
			{ role: 'assistant', content: 'Root reply' },
			{ role: 'user', content: 'Branch prompt' },
			{ role: 'assistant', content: 'Branch reply' },
		])
	})
})
