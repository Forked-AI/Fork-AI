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
		<AuroraBackground className="min-h-screen w-full">
			<div className="min-h-screen w-full relative">
				{/* Hero Section */}
				<Hero />

				{/* Features Section */}
				<div id="features">
					<Features />
				</div>

				{/* Pricing Section */}
				<div id="pricing">
					<PricingSection />
				</div>

				{/* Testimonials Section */}
				<div id="testimonials">
					<Testimonials />
				</div>

				{/* New Release Promo */}
				<NewReleasePromo />

				{/* FAQ Section */}
				<div id="faq">
					<FAQSection />
				</div>
			</div>
		</AuroraBackground>
	)
}
