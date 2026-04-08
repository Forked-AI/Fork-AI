import { Providers } from '@/components/providers'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPathname = vi.hoisted(() => ({ value: '/landing' }))

vi.mock('next/navigation', () => ({
	usePathname: () => mockPathname.value,
}))

vi.mock('@/components/chat/theme-applier', () => ({
	ThemeApplier: () => null,
}))

vi.mock('@/components/theme-provider', () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/auth-context', () => ({
	AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/site-header', () => ({
	SiteHeader: () => <div data-testid="site-header" />,
}))

vi.mock('@/components/sticky-footer', () => ({
	StickyFooter: () => <div data-testid="sticky-footer" />,
}))

vi.mock('@/components/scroll-indicator', () => ({
	ScrollIndicator: () => <div data-testid="scroll-indicator" />,
}))

describe('Providers', () => {
	beforeEach(() => {
		mockPathname.value = '/landing'
	})

	it('suppresses global chrome on public share routes', () => {
		mockPathname.value = '/share/test-token'

		const { container } = render(
			<Providers>
				<div data-testid="page-content">share page</div>
			</Providers>
		)

		expect(screen.getByTestId('page-content')).toBeInTheDocument()
		expect(screen.queryByTestId('site-header')).not.toBeInTheDocument()
		expect(screen.queryByTestId('sticky-footer')).not.toBeInTheDocument()
		expect(screen.queryByTestId('scroll-indicator')).not.toBeInTheDocument()
		expect(container.querySelector('main')).not.toHaveClass('min-h-screen', 'pb-96')
	})

	it('keeps the normal landing-page chrome intact', () => {
		const { container } = render(
			<Providers>
				<div data-testid="page-content">landing page</div>
			</Providers>
		)

		expect(screen.getByTestId('site-header')).toBeInTheDocument()
		expect(screen.getByTestId('sticky-footer')).toBeInTheDocument()
		expect(screen.getByTestId('scroll-indicator')).toBeInTheDocument()
		expect(container.querySelector('main')).toHaveClass('min-h-screen', 'pb-96')
	})

	it('keeps chat route chrome suppression unchanged', () => {
		mockPathname.value = '/chat'

		const { container } = render(
			<Providers>
				<div data-testid="page-content">chat page</div>
			</Providers>
		)

		expect(screen.queryByTestId('site-header')).not.toBeInTheDocument()
		expect(screen.queryByTestId('sticky-footer')).not.toBeInTheDocument()
		expect(screen.queryByTestId('scroll-indicator')).not.toBeInTheDocument()
		expect(container.querySelector('main')).not.toHaveClass('min-h-screen', 'pb-96')
	})
})
