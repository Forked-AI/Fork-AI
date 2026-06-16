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

vi.mock('@/components/chat/feedback-modal', () => ({
	FeedbackModal: () => null,
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
})
