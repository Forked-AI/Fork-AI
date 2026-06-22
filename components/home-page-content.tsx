'use client'

import { FAQSection } from '@/components/faq-section'
import Features from '@/components/features'
import Hero from '@/components/hero'
import { NewReleasePromo } from '@/components/new-release-promo'
import { PricingSection } from '@/components/pricing-section'
import { ScrollCanvas } from '@/components/scroll-canvas'
import { SectionWipe } from '@/components/section-wipe'
import { SmoothScroll } from '@/components/smooth-scroll'
import { TestimonialsSection as Testimonials } from '@/components/testimonials'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSettings } from '@/hooks/use-settings'
import { createPerformanceMonitor } from '@/lib/performance-monitor'
import { createDebouncedCallback } from '@/lib/rate-limit'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef, useState } from 'react'

const LOW_PERFORMANCE_FPS_THRESHOLD = 30

export function HomePageContent() {
	const isMobile = useIsMobile()
	const { settings } = useSettings()
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
	const [isAutoDegraded, setIsAutoDegraded] = useState(false)
	const hasAutoDegradedRef = useRef(false)

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
		const updateMotionPreference = () => {
			setPrefersReducedMotion(mediaQuery.matches)
		}

		updateMotionPreference()
		mediaQuery.addEventListener('change', updateMotionPreference)

		return () => {
			mediaQuery.removeEventListener('change', updateMotionPreference)
		}
	}, [])

	const shouldReduceByPreference =
		prefersReducedMotion || settings.reducedEffects

	useEffect(() => {
		if (isMobile || shouldReduceByPreference || hasAutoDegradedRef.current) {
			return
		}

		const monitor = createPerformanceMonitor({
			threshold: LOW_PERFORMANCE_FPS_THRESHOLD,
			onLowPerformance: () => {
				if (hasAutoDegradedRef.current) {
					return
				}
				hasAutoDegradedRef.current = true
				setIsAutoDegraded(true)
			},
		})

		monitor.start()
		return () => monitor.stop()
	}, [isMobile, shouldReduceByPreference])

	useEffect(() => {
		const refreshScrollTriggers = createDebouncedCallback(() => {
			ScrollTrigger.refresh()
		}, 150)

		window.addEventListener('resize', refreshScrollTriggers, { passive: true })
		window.addEventListener('orientationchange', refreshScrollTriggers, {
			passive: true,
		})

		return () => {
			window.removeEventListener('resize', refreshScrollTriggers)
			window.removeEventListener('orientationchange', refreshScrollTriggers)
			refreshScrollTriggers.cancel()
		}
	}, [])

	const shouldReduceEffects = shouldReduceByPreference || isAutoDegraded

	return (
		<SmoothScroll>
			{/* Fixed SVG energy paths that drift with scroll — behind everything */}
			{!shouldReduceEffects && <ScrollCanvas />}

			<AuroraBackground
				className="min-h-screen w-full"
				reducedEffects={shouldReduceEffects}
			>
				<div className="min-h-screen w-full relative">
					{/* Hero Section */}
					<Hero showGlowSphere={!isMobile && !shouldReduceEffects} />

					{/* Wipe curtain between Hero → Features */}
					<SectionWipe
						id="wipe-hero-features"
						fromColor="rgba(5,5,10,0)"
						toColor="rgba(5,5,10,0)"
					/>

					{/* Features Section */}
					<Features />

					{/* Wipe curtain between Features → Pricing */}
					<SectionWipe
						id="wipe-features-pricing"
						fromColor="rgba(5,5,10,0)"
						toColor="rgba(15,10,30,0)"
					/>

					{/* Pricing Section */}
					<PricingSection />

					{/* Wipe curtain between Pricing → Testimonials */}
					<SectionWipe
						id="wipe-pricing-testimonials"
						fromColor="rgba(10,5,20,0)"
						toColor="rgba(5,5,10,0)"
					/>

					{/* Testimonials Section */}
					<Testimonials />

					{/* New Release Promo */}
					<NewReleasePromo />

					{/* FAQ Section */}
					<FAQSection />
				</div>
			</AuroraBackground>
		</SmoothScroll>
	)
}
