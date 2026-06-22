import { HomePageContent } from '@/components/home-page-content'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseIsMobile = vi.hoisted(() => vi.fn())
const mockUseSettings = vi.hoisted(() => vi.fn())
const mockCreatePerformanceMonitor = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/use-mobile', () => ({
	useIsMobile: () => mockUseIsMobile(),
}))

vi.mock('@/hooks/use-settings', () => ({
	useSettings: () => mockUseSettings(),
}))

vi.mock('@/lib/performance-monitor', () => ({
	createPerformanceMonitor: (...args: unknown[]) =>
		mockCreatePerformanceMonitor(...args),
}))

vi.mock('@/components/smooth-scroll', () => ({
	SmoothScroll: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/scroll-canvas', () => ({
	ScrollCanvas: () => <div data-testid="scroll-canvas" />,
}))

vi.mock('@/components/ui/aurora-background', () => ({
	AuroraBackground: ({
		children,
		reducedEffects,
	}: {
		children: ReactNode
		reducedEffects?: boolean
	}) => (
		<div data-testid="aurora" data-reduced-effects={String(Boolean(reducedEffects))}>
			{children}
		</div>
	),
}))

vi.mock('@/components/hero', () => ({
	__esModule: true,
	default: ({ showGlowSphere }: { showGlowSphere?: boolean }) => (
		<div
			data-testid="hero"
			data-show-glow-sphere={String(Boolean(showGlowSphere))}
		/>
	),
}))

vi.mock('@/components/faq-section', () => ({ FAQSection: () => <div /> }))
vi.mock('@/components/features', () => ({
	__esModule: true,
	default: () => <div />,
}))
vi.mock('@/components/new-release-promo', () => ({
	NewReleasePromo: () => <div />,
}))
vi.mock('@/components/pricing-section', () => ({
	PricingSection: () => <div />,
}))
vi.mock('@/components/section-wipe', () => ({
	SectionWipe: () => <div />,
}))
vi.mock('@/components/testimonials', () => ({
	TestimonialsSection: () => <div />,
}))

describe('HomePageContent', () => {
	beforeEach(() => {
		vi.clearAllMocks()

		mockUseIsMobile.mockReturnValue(false)
		mockUseSettings.mockReturnValue({ settings: { reducedEffects: false } })
		mockCreatePerformanceMonitor.mockImplementation(() => ({
			start: vi.fn(),
			stop: vi.fn(),
		}))

		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation(() => ({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		})
	})

	it('enables the glowing sphere on desktop with full effects', () => {
		render(<HomePageContent />)

		expect(screen.getByTestId('hero')).toHaveAttribute(
			'data-show-glow-sphere',
			'true'
		)
	})

	it('keeps full effects enabled by default', () => {
		render(<HomePageContent />)

		expect(screen.getByTestId('scroll-canvas')).toBeInTheDocument()
		expect(screen.getByTestId('aurora')).toHaveAttribute(
			'data-reduced-effects',
			'false'
		)
	})

	it('reduces effects when reducedEffects setting is enabled', () => {
		mockUseSettings.mockReturnValue({ settings: { reducedEffects: true } })

		render(<HomePageContent />)

		expect(screen.getByTestId('hero')).toHaveAttribute(
			'data-show-glow-sphere',
			'false'
		)
		expect(screen.queryByTestId('scroll-canvas')).not.toBeInTheDocument()
		expect(screen.getByTestId('aurora')).toHaveAttribute(
			'data-reduced-effects',
			'true'
		)
	})

	it('auto-degrades when sustained low performance is reported', async () => {
		mockCreatePerformanceMonitor.mockImplementation(
			(options?: {
				onLowPerformance?: (metrics: {
					fps: number
					averageFps: number
					frameTime: number
					isPerformant: boolean
				}) => void
			}) => ({
				start: () =>
					options?.onLowPerformance?.({
						fps: 18,
						averageFps: 22,
						frameTime: 55,
						isPerformant: false,
					}),
				stop: vi.fn(),
			})
		)

		render(<HomePageContent />)

		await waitFor(() => {
			expect(screen.queryByTestId('scroll-canvas')).not.toBeInTheDocument()
		})
		expect(screen.getByTestId('hero')).toHaveAttribute(
			'data-show-glow-sphere',
			'false'
		)
		expect(screen.getByTestId('aurora')).toHaveAttribute(
			'data-reduced-effects',
			'true'
		)
	})

	it('skips auto-monitoring on mobile', () => {
		mockUseIsMobile.mockReturnValue(true)

		render(<HomePageContent />)

		expect(screen.getByTestId('hero')).toHaveAttribute(
			'data-show-glow-sphere',
			'false'
		)
		expect(mockCreatePerformanceMonitor).not.toHaveBeenCalled()
	})
})
