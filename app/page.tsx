/**
 * HOME PAGE - FULL LANDING PAGE
 * This is the main landing page with all sections unmasked.
 */

import { FAQSection } from '@/components/faq-section'
import Features from '@/components/features'
import Hero from '@/components/hero'
import { NewReleasePromo } from '@/components/new-release-promo'
import { PricingSection } from '@/components/pricing-section'
import { TestimonialsSection as Testimonials } from '@/components/testimonials'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { SmoothScroll } from '@/components/smooth-scroll'
import { ScrollCanvas } from '@/components/scroll-canvas'
import { SectionWipe } from '@/components/section-wipe'
import type { Metadata } from 'next'

// SEO: Ensure home page has metadata
export const metadata: Metadata = {
	title: 'Fork AI | Multi-AI Platform & Branching Conversations',
	description:
		'Fork AI: Multi-AI platform with branching conversations. Compare ChatGPT, Claude, Gemini side-by-side. Fork conversations, explore paths, and unlock AI potential.',
	alternates: {
		canonical: '/',
	},
}

export default function Home() {
	return (
		<SmoothScroll>
			{/* Fixed SVG energy paths that drift with scroll — behind everything */}
			<ScrollCanvas />

			<AuroraBackground className="min-h-screen w-full">
				<div className="min-h-screen w-full relative">
					{/* Hero Section */}
					<Hero />

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
