import { ChatSharesPage } from '@/components/chat/chat-shares-page'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.fn()
const fetchMock = vi.fn()
const clipboardWriteText = vi.fn()

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

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast }),
}))

describe('ChatSharesPage', () => {
	beforeEach(() => {
		vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-08T12:00:00.000Z').getTime())
		toast.mockReset()
		fetchMock.mockReset()
		clipboardWriteText.mockReset()
		vi.stubGlobal('fetch', fetchMock)
		Object.defineProperty(window.navigator, 'clipboard', {
			value: {
				writeText: clipboardWriteText,
			},
			configurable: true,
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it('renders the empty state when the account has no active shares', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ shares: [] }),
		})

		render(<ChatSharesPage />)

		expect(await screen.findByText('No active shares yet')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Open a conversation' })).toHaveAttribute(
			'href',
			'/chat'
		)
	})

	it('renders share cards and supports copy, open, and revoke actions', async () => {
		const user = userEvent.setup()
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					shares: [
						{
							id: 'share-active',
							shareToken: 'token-active',
							shareUrl: 'https://fork.ai/share/token-active',
							title: 'Quarterly review',
							conversationTitle: 'Q2 planning',
							messageCount: 6,
							accessCount: 14,
							expiresAt: '2026-04-09T00:00:00.000Z',
							allowDownload: true,
							showTimestamps: true,
							showModel: true,
							hasSummary: true,
							createdAt: '2026-04-01T00:00:00.000Z',
						},
						{
							id: 'share-expired',
							shareToken: 'token-expired',
							shareUrl: 'https://fork.ai/share/token-expired',
							title: 'Old launch notes',
							conversationTitle: 'Launch retrospective',
							messageCount: 3,
							accessCount: 2,
							expiresAt: '2026-04-01T00:00:00.000Z',
							allowDownload: false,
							showTimestamps: true,
							showModel: false,
							hasSummary: false,
							createdAt: '2026-03-02T00:00:00.000Z',
						},
					],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			})

		render(<ChatSharesPage />)

		const activeCard = await screen.findByTestId('share-card-token-active')
		const expiredCard = await screen.findByTestId('share-card-token-expired')

		expect(within(activeCard).getByText('Active')).toBeInTheDocument()
		expect(within(activeCard).getByText('7 days')).toBeInTheDocument()
		expect(within(expiredCard).getByText('Expired')).toBeInTheDocument()
		expect(within(expiredCard).getByText('30 days')).toBeInTheDocument()
		expect(
			within(activeCard).getByRole('link', { name: 'Open public page' })
		).toHaveAttribute('href', 'https://fork.ai/share/token-active')

		await user.click(within(activeCard).getByRole('button', { name: 'Copy link' }))

		await waitFor(() => {
			expect(toast).toHaveBeenCalledWith({
				title: 'Link copied',
				description: 'The public share URL is ready to paste.',
			})
		})
		expect(within(activeCard).getByRole('button', { name: 'Copied' })).toBeInTheDocument()

		await user.click(within(expiredCard).getByRole('button', { name: 'Revoke' }))

		await waitFor(() => {
			expect(screen.queryByTestId('share-card-token-expired')).not.toBeInTheDocument()
		})
		expect(fetchMock).toHaveBeenLastCalledWith('/api/share/token-expired', {
			method: 'DELETE',
			credentials: 'include',
		})
		expect(toast).toHaveBeenCalledWith({
			title: 'Share revoked',
			description: 'The link is no longer active.',
		})
	})
})
