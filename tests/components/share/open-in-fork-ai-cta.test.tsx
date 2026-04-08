import { OpenInForkAICta } from '@/components/share/open-in-fork-ai-cta'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRouterPush = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
	useRouter: () => ({
		push: mockRouterPush,
	}),
}))

vi.mock('next/link', () => ({
	default: ({
		href,
		children,
		prefetch: _prefetch,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
		href: string
		prefetch?: boolean
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}))

describe('OpenInForkAICta', () => {
	beforeEach(() => {
		mockRouterPush.mockReset()
		vi.restoreAllMocks()
	})

	it('renders a login resume link for signed-out viewers', () => {
		render(
			<OpenInForkAICta
				shareToken="share-token"
				conversationId="conversation-1"
				shareOwnerId="owner-1"
				viewerUserId={null}
				autoOpen={false}
			/>
		)

		expect(screen.getByTestId('share-open-in-fork-ai-floating-cta')).toHaveAttribute(
			'href',
			'/login?next=%2Fshare%2Fshare-token%3FopenInChat%3D1'
		)
	})

	it('renders an exact chat deep link for owners', () => {
		render(
			<OpenInForkAICta
				shareToken="share-token"
				conversationId="conversation-1"
				shareOwnerId="owner-1"
				viewerUserId="owner-1"
				autoOpen={false}
			/>
		)

		expect(screen.getByTestId('share-open-in-fork-ai-floating-cta')).toHaveAttribute(
			'href',
			'/chat?c=conversation-1'
		)
	})

	it('imports a shared conversation for non-owners and navigates to the new chat', async () => {
		const user = userEvent.setup()
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ conversationId: 'imported-conversation-1' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)

		render(
			<OpenInForkAICta
				shareToken="share-token"
				conversationId="conversation-1"
				shareOwnerId="owner-1"
				viewerUserId="viewer-2"
				autoOpen={false}
			/>
		)

		await user.click(screen.getByTestId('share-open-in-fork-ai-floating-cta'))

		expect(fetchMock).toHaveBeenCalledWith('/api/share/share-token/import', {
			method: 'POST',
			credentials: 'include',
		})
		await waitFor(() => {
			expect(mockRouterPush).toHaveBeenCalledWith('/chat?c=imported-conversation-1')
		})
	})

	it('auto-opens only once for signed-in non-owners resuming after auth', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify({ conversationId: 'imported-conversation-2' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)

		const { rerender } = render(
			<OpenInForkAICta
				shareToken="share-token"
				conversationId="conversation-1"
				shareOwnerId="owner-1"
				viewerUserId="viewer-2"
				autoOpen={true}
			/>
		)

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})

		rerender(
			<OpenInForkAICta
				shareToken="share-token"
				conversationId="conversation-1"
				shareOwnerId="owner-1"
				viewerUserId="viewer-2"
				autoOpen={true}
			/>
		)

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})
	})

	it('surfaces an error state on the CTA when import fails', async () => {
		const user = userEvent.setup()
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: 'Import failed' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			})
		)

		render(
			<OpenInForkAICta
				shareToken="share-token"
				conversationId="conversation-1"
				shareOwnerId="owner-1"
				viewerUserId="viewer-2"
				autoOpen={false}
			/>
		)

		await user.click(screen.getByTestId('share-open-in-fork-ai-floating-cta'))

		await waitFor(() => {
			expect(
				screen.getByTestId('share-open-in-fork-ai-floating-cta-error')
			).toHaveTextContent('Import failed')
		})
		expect(mockRouterPush).not.toHaveBeenCalled()
	})
})
