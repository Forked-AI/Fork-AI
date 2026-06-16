import { SelectiveShareModal } from '@/components/chat/selective-share-modal'
import type { Message } from '@/hooks/use-chat'
import type { SharePreviewResponse } from '@/lib/share/types'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.fn()
const fetchMock = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast }),
}))

vi.mock('next/link', () => ({
	default: ({
		href,
		children,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}))

function createConversationMessage(
	id: string,
	role: Message['role'],
	content: string
): Message {
	return {
		id,
		role,
		content,
		createdAt: new Date('2026-04-07T10:00:00.000Z'),
	}
}

function createPreviewResponse(): SharePreviewResponse {
	return {
		messages: [
			{
				id: 'long',
				role: 'assistant',
				model: 'mistral-large-latest',
				createdAt: '2026-04-07T10:00:00.000Z',
				orderIndex: 1,
				originalContent: Array.from({ length: 12 }, (_, index) => `Long line ${index + 1}`).join('\n'),
				maskedContent: Array.from({ length: 12 }, (_, index) => `Long line ${index + 1}`).join('\n'),
				findings: [],
				approvedFindingIds: [],
			},
			{
				id: 'short',
				role: 'user',
				createdAt: '2026-04-07T10:02:00.000Z',
				orderIndex: 2,
				originalContent: 'Short prompt',
				maskedContent: 'Short prompt',
				findings: [],
				approvedFindingIds: [],
			},
		],
		summary: null,
		summaryWarning: null,
	}
}

function renderModal() {
	return render(
		<SelectiveShareModal
			open
			onOpenChange={vi.fn()}
			conversationId="conv-1"
			conversationTitle="Share test"
			selectedMessageIds={['long', 'short']}
			allMessages={[
				createConversationMessage('long', 'assistant', 'Long original content'),
				createConversationMessage('short', 'user', 'Short prompt'),
			]}
		/>
	)
}

describe('SelectiveShareModal', () => {
	beforeEach(() => {
		toast.mockReset()
		fetchMock.mockReset()
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => createPreviewResponse(),
		})
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('renders long preview messages collapsed in a dedicated scroll area while keeping summary/settings outside it', async () => {
		renderModal()

		const scrollArea = await screen.findByTestId('share-preview-scroll-area')
		const longBody = await screen.findByTestId('share-preview-body-long')
		const shortBody = await screen.findByTestId('share-preview-body-short')
		const summaryHeading = screen.getByText('Share Summary')

		expect(scrollArea).toBeInTheDocument()
		expect(longBody.className).toContain('max-h-40')
		expect(shortBody.className).not.toContain('max-h-40')
		expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument()
		expect(scrollArea.contains(summaryHeading)).toBe(false)
	})

	it('expands and collapses long preview messages on demand', async () => {
		const user = userEvent.setup()
		renderModal()

		const longBody = await screen.findByTestId('share-preview-body-long')
		const toggle = await screen.findByRole('button', { name: 'Show more' })

		expect(longBody.className).toContain('max-h-40')

		await user.click(toggle)

		expect(longBody.className).not.toContain('max-h-40')
		expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Show less' }))

		expect(longBody.className).toContain('max-h-40')
	})

	it('removes collapse controls when a long preview message is fully redacted', async () => {
		const user = userEvent.setup()
		renderModal()

		const longCard = await screen.findByTestId('share-preview-card-long')
		await user.click(within(longCard).getByRole('button', { name: 'Redact Message' }))

		await waitFor(() => {
			expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
		})
		expect(screen.getByText('[Message redacted by author]')).toBeInTheDocument()
	})

	it('auto-completes missing conversation pairs through the callback prop', async () => {
		const user = userEvent.setup()
		const onAutoCompletePairs = vi.fn()

		render(
			<SelectiveShareModal
				open
				onOpenChange={vi.fn()}
				conversationId="conv-1"
				conversationTitle="Share test"
				selectedMessageIds={['assistant-only']}
				allMessages={[
					createConversationMessage('user-parent', 'user', 'Question'),
					{
						...createConversationMessage(
							'assistant-only',
							'assistant',
							'Answer'
						),
						parentMessageId: 'user-parent',
					},
				]}
				onAutoCompletePairs={onAutoCompletePairs}
			/>
		)

		await user.click(await screen.findByRole('button', { name: 'Auto-complete' }))

		expect(onAutoCompletePairs).toHaveBeenCalledWith(['user-parent'])
	})

	it('shows a manage shares link after publishing', async () => {
		const user = userEvent.setup()
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				json: async () => createPreviewResponse(),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					shareUrl: 'https://fork.ai/share/token-1',
					shareToken: 'token-1',
					expiresAt: null,
					messageCount: 2,
					hasSummary: false,
				}),
			})

		renderModal()

		await user.click(await screen.findByRole('button', { name: 'Publish Share Link' }))

		expect(await screen.findByRole('link', { name: 'Manage shares' })).toHaveAttribute(
			'href',
			'/chat/shares'
		)
	})
})
