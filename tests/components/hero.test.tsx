import Hero from '@/components/hero'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('@/contexts/auth-context', () => ({
	useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/fonts', () => ({
	geist: { className: 'font-geist' },
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

vi.mock('@gsap/react', () => ({
	useGSAP: vi.fn(),
}))

vi.mock('gsap', () => ({
	default: {
		registerPlugin: vi.fn(),
		set: vi.fn(),
		matchMedia: () => ({
			add: vi.fn(),
			revert: vi.fn(),
		}),
		from: vi.fn(),
		to: vi.fn(),
		timeline: vi.fn(() => ({
			to: vi.fn().mockReturnThis(),
		})),
	},
}))

vi.mock('gsap/ScrollTrigger', () => ({
	ScrollTrigger: {},
}))

vi.mock('framer-motion', () => ({
	AnimatePresence: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	motion: {
		div: ({
			children,
			animate: _animate,
			transition: _transition,
			...props
		}: React.HTMLAttributes<HTMLDivElement> & {
			animate?: unknown
			transition?: unknown
		}) => <div {...props}>{children}</div>,
		span: ({
			children,
			initial: _initial,
			animate: _animate,
			exit: _exit,
			transition: _transition,
			...props
		}: React.HTMLAttributes<HTMLSpanElement> & {
			initial?: unknown
			animate?: unknown
			exit?: unknown
			transition?: unknown
		}) => <span {...props}>{children}</span>,
		rect: ({
			animate: _animate,
			transition: _transition,
			...props
		}: React.SVGProps<SVGRectElement> & {
			animate?: unknown
			transition?: unknown
		}) => <rect {...props} />,
	},
}))

describe('Hero', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseAuth.mockReturnValue({ isAuthenticated: false })
	})

	it('sends logged-out users to early access from the primary CTA', () => {
		render(<Hero showGlowSphere={false} />)

		expect(
			screen.getByRole('link', { name: /get early access/i })
		).toHaveAttribute('href', '/prelaunch')
	})

	it('sends logged-in users directly to chat from the primary CTA', () => {
		mockUseAuth.mockReturnValue({ isAuthenticated: true })

		render(<Hero showGlowSphere={false} />)

		expect(screen.getByRole('link', { name: /open chat/i })).toHaveAttribute(
			'href',
			'/chat'
		)
	})
})
