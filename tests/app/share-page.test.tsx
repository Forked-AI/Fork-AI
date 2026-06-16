import SharePage from '@/app/share/[token]/page'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
	update: vi.fn(),
}))
const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}))
const rateLimitMocks = vi.hoisted(() => ({
	checkRequestRateLimit: vi.fn(),
}))
const mockSession = vi.hoisted(() => ({
	value: null as { user: { id: string } } | null,
}))
const mockRedirect = vi.hoisted(() =>
	vi.fn((url: string) => {
		throw new Error(`REDIRECT:${url}`)
	})
)
const mockRouterPush = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
	prisma: {
		sharedConversation: {
			findUnique: prismaMocks.findUnique,
			update: prismaMocks.update,
		},
	},
}))

vi.mock('@/lib/auth', () => ({
	auth: {
		api: {
			getSession: authMocks.getSession,
		},
	},
}))

vi.mock('@/lib/api-rate-limit', () => ({
	checkRequestRateLimit: rateLimitMocks.checkRequestRateLimit,
}))

vi.mock('next/headers', () => ({
	headers: async () => new Headers(),
}))

vi.mock('next/navigation', () => ({
	redirect: mockRedirect,
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
	}) => React.createElement('a', { href, ...props }, children),
}))

vi.mock('next/image', () => ({
	default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
		React.createElement('img', props),
}))

describe('SharePage', () => {
	beforeEach(() => {
		prismaMocks.findUnique.mockReset()
		prismaMocks.update.mockReset()
		authMocks.getSession.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockReset()
		mockRedirect.mockClear()
		mockRouterPush.mockReset()
		mockSession.value = null

		prismaMocks.update.mockResolvedValue({})
		authMocks.getSession.mockImplementation(async () => mockSession.value)
		rateLimitMocks.checkRequestRateLimit.mockResolvedValue({
			allowed: true,
			state: {
				allowed: true,
				remaining: 59,
				resetAt: new Date('2026-04-08T00:01:00.000Z'),
			},
			identityHash: 'identity',
		})
		prismaMocks.findUnique.mockResolvedValue({
			id: 'share-record-1',
			shareToken: 'token-1',
			conversationId: 'conversation-1',
			createdBy: 'owner-1',
			title: 'Shared thread',
			isActive: true,
			expiresAt: null,
			allowDownload: false,
			showTimestamps: true,
			showModel: true,
			snapshotData: JSON.stringify([
				{
					id: 'msg-1',
					role: 'assistant',
					content: [
						`<https://example.com/${'very-long-path-'.repeat(12)}>`,
						'',
						'| Col A | Col B |',
						'| --- | --- |',
						`| left | ${'value-'.repeat(20)} |`,
					].join('\n'),
					model: 'mistral-large-latest',
					createdAt: '2026-04-07T10:00:00.000Z',
					orderIndex: 1,
				},
			]),
			summaryData: JSON.stringify({
				overview: 'Compact summary content',
				keyPoints: ['One key point'],
				model: 'ministral-3b-latest',
				generatedAt: '2026-04-07T10:01:00.000Z',
			}),
		})
	})

	it('renders the owner CTA as an exact chat deep link and keeps shared content contained', async () => {
		mockSession.value = { user: { id: 'owner-1' } }

		const view = await SharePage({
			params: Promise.resolve({ token: 'token-1' }),
			searchParams: Promise.resolve({}),
		})
		const { container } = render(view)

		const pageRoot = container.firstElementChild as HTMLElement
		const main = container.querySelector('main') as HTMLElement
		const summaryCard = screen.getByTestId('share-summary-card')
		const messageRow = screen.getByTestId('shared-message-row-msg-1')
		const messageBubble = screen.getByTestId('shared-message-bubble-msg-1')
		const floatingCta = screen.getByTestId('share-open-in-fork-ai-floating-cta')

		expect(pageRoot.className).toContain('overflow-x-hidden')
		expect(main.className).toContain('pb-32')
		expect(summaryCard.className).toContain('overflow-hidden')
		expect(messageRow.className).toContain('w-full')
		expect(messageRow.className).toContain('min-w-0')
		expect(messageBubble.className).toContain('overflow-hidden')
		expect(messageBubble.className).toContain('sm:max-w-[85%]')
		expect(floatingCta).toHaveAttribute('href', '/chat?c=conversation-1')
		expect(floatingCta.className).toContain('fixed')
		expect(screen.getByText('Compact summary content')).toBeInTheDocument()
	})

	it('renders the signed-out CTA as a login resume link', async () => {
		const view = await SharePage({
			params: Promise.resolve({ token: 'token-1' }),
			searchParams: Promise.resolve({}),
		})
		render(view)

		expect(screen.getByTestId('share-open-in-fork-ai-floating-cta')).toHaveAttribute(
			'href',
			'/login?next=%2Fshare%2Ftoken-1%3FopenInChat%3D1'
		)
	})

	it('redirects signed-in owners straight to the original chat when openInChat is requested', async () => {
		mockSession.value = { user: { id: 'owner-1' } }

		await expect(
			SharePage({
				params: Promise.resolve({ token: 'token-1' }),
				searchParams: Promise.resolve({ openInChat: '1' }),
			})
		).rejects.toThrow('REDIRECT:/chat?c=conversation-1')

		expect(mockRedirect).toHaveBeenCalledWith('/chat?c=conversation-1')
	})
})
