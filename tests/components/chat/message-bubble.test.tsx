import { MessageBubble } from '@/components/chat/chat-area/message-bubble'
import type { Message } from '@/hooks/use-chat'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/use-settings', () => ({
	useSettings: () => ({
		settings: {
			messageTruncateLength: 10,
		},
	}),
}))

vi.mock('@/components/chat/markdown-renderer', () => ({
	MarkdownRenderer: ({ content }: { content: string }) => (
		<div data-testid="markdown-renderer">{content}</div>
	),
}))

function createMessage(overrides: Partial<Message>): Message {
	return {
		id: 'message-1',
		role: 'user',
		content: '0123456789abcdefghij',
		createdAt: new Date('2026-04-08T10:00:00.000Z'),
		...overrides,
	}
}

describe('MessageBubble', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ success: true }),
			})
		)
	})

	it('allows editing a user message and resending it', async () => {
		const user = userEvent.setup()
		const onEdit = vi.fn()

		render(
			<MessageBubble
				message={createMessage({ role: 'user' })}
				onRetry={vi.fn()}
				onStop={vi.fn()}
				onEdit={onEdit}
				isStreaming={false}
			/>
		)

		expect(screen.getByText('Show more')).toBeInTheDocument()

		await user.click(screen.getByTitle('Click to edit'))

		const textarea = screen.getByPlaceholderText('Edit your message...')
		await user.clear(textarea)
		await user.type(textarea, 'Edited prompt')
		await user.click(screen.getByText('Save & Resend'))

		expect(onEdit).toHaveBeenCalledWith('message-1', 'Edited prompt')
	})

	it('supports selecting and retrying an assistant response', async () => {
		const user = userEvent.setup()
		const onRetry = vi.fn()
		const onToggleSelection = vi.fn()

		render(
			<MessageBubble
				message={createMessage({
					role: 'assistant',
					content: 'Assistant output',
					model: 'gpt-5',
					isError: true,
				})}
				onRetry={onRetry}
				onStop={vi.fn()}
				onEdit={vi.fn()}
				isStreaming={false}
				onToggleSelection={onToggleSelection}
			/>
		)

		await user.click(screen.getByTitle('Select message'))
		await user.click(screen.getAllByText('Retry')[0])

		expect(onToggleSelection).toHaveBeenCalledTimes(1)
		expect(onRetry).toHaveBeenCalledWith('message-1')
	})

	it('disables mutating actions when the queue is locked', async () => {
		const user = userEvent.setup()

		render(
			<>
				<MessageBubble
					message={createMessage({ role: 'user' })}
					onRetry={vi.fn()}
					onStop={vi.fn()}
					onEdit={vi.fn()}
					isStreaming={false}
					disableMutatingActions={true}
				/>
				<MessageBubble
					message={createMessage({
						id: 'assistant-1',
						role: 'assistant',
						content: 'Assistant output',
						model: 'gpt-5',
						parentMessageId: 'message-1',
					})}
					onRetry={vi.fn()}
					onStop={vi.fn()}
					onEdit={vi.fn()}
					isStreaming={false}
					disableMutatingActions={true}
					siblingNav={{
						currentIndex: 1,
						totalCount: 2,
						onPrevious: vi.fn(),
						onNext: vi.fn(),
						disabled: true,
					}}
				/>
			</>
		)

		await user.click(screen.getByTitle('Queue must finish before editing'))

		expect(
			screen.queryByPlaceholderText('Edit your message...')
		).not.toBeInTheDocument()
		expect(screen.getByText('Retry')).toBeDisabled()
		expect(screen.getByTitle('Next version')).toBeDisabled()
	})

	it('does not enter edit mode while user text is selected', async () => {
		const user = userEvent.setup()
		const getSelection = vi.spyOn(window, 'getSelection').mockReturnValue({
			toString: () => 'Selected prompt text',
		} as unknown as Selection)

		render(
			<MessageBubble
				message={createMessage({
					role: 'user',
					content: 'Selected prompt text',
				})}
				onRetry={vi.fn()}
				onStop={vi.fn()}
				onEdit={vi.fn()}
				isStreaming={false}
			/>
		)

		await user.click(screen.getByTitle('Click to edit'))

		expect(
			screen.queryByPlaceholderText('Edit your message...')
		).not.toBeInTheDocument()
		getSelection.mockRestore()
	})

	it('shows run details with sources, tools, fallback, and trace metadata', async () => {
		const user = userEvent.setup()

		render(
			<MessageBubble
				message={createMessage({
					role: 'assistant',
					content: 'Assistant output',
					model: 'mistral-large-latest',
					citations: [
						{
							index: 1,
							chunkId: 'chunk-1',
							fileId: 'file-1',
							sourceLabel: 'policy.md#1',
							pageNumber: null,
							score: 0.72,
						},
					],
					trustTrace: {
						traceId: 'provider-request-1',
						generationId: 'generation-1',
						providerRequestId: 'provider-request-1',
						provider: 'mistral',
						selectedModel: 'mistral-large-latest',
						resolvedModel: 'mistral-small-latest',
						fallbackUsed: true,
						promptVersion: 'chat-context-v1',
						generationStatus: 'completed',
						evidenceState: 'grounded',
						citationCount: 1,
						citations: [],
						usedTools: [
							{
								id: 'tool-1',
								name: 'web.search',
								status: 'succeeded',
								riskLevel: 'medium',
								requiresConfirmation: false,
							},
						],
						activeSkills: [
							{
								title: 'Research',
								templateId: 'skill-1',
								versionId: 'version-1',
								source: 'first_party',
							},
						],
						context: {
							estimatedTokens: 120,
							recentMessageCount: 2,
							totalMessageCount: 4,
							summaryUsed: true,
						},
					},
				})}
				onRetry={vi.fn()}
				onStop={vi.fn()}
				onEdit={vi.fn()}
				isStreaming={false}
			/>
		)

		expect(screen.getByText('Fallback')).toBeInTheDocument()
		expect(screen.getByText('Grounded')).toBeInTheDocument()

		await user.click(screen.getByText('Run details'))

		expect(
			screen.getByText('Resolved to mistral-small-latest')
		).toBeInTheDocument()
		expect(screen.getByText('provider-request-1')).toBeInTheDocument()
		expect(screen.getAllByText('policy.md#1').length).toBeGreaterThan(0)
		expect(screen.getByText('web.search · succeeded')).toBeInTheDocument()
		expect(screen.getByText('Research')).toBeInTheDocument()
	})

	it('submits structured feedback reasons and a correction', async () => {
		const user = userEvent.setup()
		const fetchMock = vi.mocked(fetch)

		render(
			<MessageBubble
				message={createMessage({
					id: 'assistant-1',
					role: 'assistant',
					content: 'Assistant output',
					model: 'gpt-5',
				})}
				onRetry={vi.fn()}
				onStop={vi.fn()}
				onEdit={vi.fn()}
				isStreaming={false}
			/>
		)

		await user.click(screen.getByTitle('Bad response'))
		await user.click(screen.getByText('Unsupported by source'))
		await user.type(
			screen.getByPlaceholderText(
				'Write the answer you expected or the correction Fork AI should learn from.'
			),
			'Use the uploaded policy.'
		)
		await user.type(
			screen.getByPlaceholderText('Tell us more about what went wrong...'),
			'Citation was unrelated.'
		)
		await user.click(screen.getByText('Submit Feedback'))

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/chat/feedback',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					messageId: 'assistant-1',
					type: 'bad',
					reasons: ['unsupported_by_source'],
					comment: 'Citation was unrelated.',
					correction: 'Use the uploaded policy.',
				}),
			})
		)
	})

	it('shows a compact no-file-evidence caveat for model-only answers', () => {
		render(
			<MessageBubble
				message={createMessage({
					id: 'assistant-2',
					role: 'assistant',
					content: 'Model-only answer',
					model: 'gpt-5',
					trustTrace: {
						traceId: 'generation-2',
						generationId: 'generation-2',
						providerRequestId: null,
						provider: 'openai',
						selectedModel: 'gpt-5',
						resolvedModel: 'gpt-5',
						fallbackUsed: false,
						promptVersion: 'chat-context-v1',
						generationStatus: 'completed',
						evidenceState: 'model_only',
						citationCount: 0,
						citations: [],
						usedTools: [],
						activeSkills: [],
						context: {
							estimatedTokens: 100,
							recentMessageCount: 1,
							totalMessageCount: 1,
							summaryUsed: false,
						},
					},
				})}
				onRetry={vi.fn()}
				onStop={vi.fn()}
				onEdit={vi.fn()}
				isStreaming={false}
			/>
		)

		expect(
			screen.getByText(
				'No file evidence was found for this answer. Ask a follow-up or retry with web search when available.'
			)
		).toBeInTheDocument()
	})
})
