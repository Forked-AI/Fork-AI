import { SiteHeader } from '@/components/site-header'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPathname = vi.hoisted(() => ({ value: '/landing' }))
const authClientMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
	usePathname: () => mockPathname.value,
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

vi.mock('@/lib/auth-client', () => ({
	authClient: authClientMocks,
}))

describe('SiteHeader', () => {
	beforeEach(() => {
		mockPathname.value = '/landing'
		authClientMocks.getSession.mockReset()
		authClientMocks.signOut.mockReset()
		authClientMocks.getSession.mockResolvedValue({ data: null })
		authClientMocks.signOut.mockResolvedValue(undefined)
	})

	it('returns null on public share routes', async () => {
		mockPathname.value = '/share/test-token'

		const { container } = render(<SiteHeader />)

		await waitFor(() => {
			expect(authClientMocks.getSession).toHaveBeenCalled()
		})
		expect(container.firstChild).toBeNull()
	})

	it('still renders on landing routes', async () => {
		render(<SiteHeader />)

		await waitFor(() => {
			expect(authClientMocks.getSession).toHaveBeenCalled()
		})
		expect(screen.getAllByText('ForkAI').length).toBeGreaterThan(0)
		expect(screen.getAllByText('Features').length).toBeGreaterThan(0)
	})

	it('shows a direct chat link for signed-in users on desktop', async () => {
		authClientMocks.getSession.mockResolvedValue({
			data: {
				user: { name: 'Ada' },
			},
		})

		render(<SiteHeader />)

		const welcome = await screen.findByText('Welcome, Ada')
		expect(welcome).toHaveClass('hidden', 'xl:block')
		expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveClass(
			'min-w-0'
		)
		expect(screen.getByRole('navigation', { name: 'Primary' })).not.toHaveClass(
			'absolute'
		)
		expect(screen.getByRole('link', { name: 'Open Chat' })).toHaveAttribute(
			'href',
			'/chat'
		)
	})

	it('shows a direct chat link for signed-in users in the mobile menu', async () => {
		authClientMocks.getSession.mockResolvedValue({
			data: {
				user: { name: 'Ada' },
			},
		})

		render(<SiteHeader />)

		await screen.findByText('Welcome, Ada')
		fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))

		expect(screen.getAllByRole('link', { name: 'Open Chat' })).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					href: expect.stringContaining('/chat'),
				}),
			])
		)
	})
})
