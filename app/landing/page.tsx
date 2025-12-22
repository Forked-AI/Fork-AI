/**
 * LANDING PAGE WITH MASKED SECTIONS
 * This is the full landing page with sections after Hero masked during prelaunch.
 * Only the Hero section is visible; other sections are commented out.
 *
 * SEE: PRELAUNCH-RESTORATION.md for restoration instructions when ready to launch.
 */

import Hero from '@/components/hero'
import { AuroraBackground } from '@/components/ui/aurora-background'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Multi-AI Chat Platform & AI Workspace',
	description:
		'Fork AI is a powerful multi-AI chat platform that lets you interact with ChatGPT, Claude, and Gemini in one workspace. Branch conversations, switch models, and start free today.',
	openGraph: {
		title:
			'Fork AI – The Multi-AI Chat Platform Built for Effortless Conversations',
		description:
			'Branch, compare, and switch between ChatGPT, Claude, and Gemini without losing context. Free to start, no credit card required.',
	},
}

export default function Landing() {
	return (
		<AuroraBackground className="min-h-screen w-full">
			<div className="min-h-screen w-full relative">
				{/* Hero Section */}
				<Hero />

				{/* 
          ═══════════════════════════════════════════════════════════════
          MASKED DURING PRELAUNCH PHASE
          ═══════════════════════════════════════════════════════════════
          The sections below are hidden from the DOM during prelaunch.
          
          TO RESTORE: Uncomment all sections below when ready to launch.
          SEE: PRELAUNCH-RESTORATION.md for complete restoration steps.
          ═══════════════════════════════════════════════════════════════
        */}

				{/* Features Section */}
				{/* <div id="features">
          <Features />
        </div> */}

				{/* Pricing Section */}
				{/* <div id="pricing">
          <PricingSection />
        </div> */}

				{/* Testimonials Section */}
				{/* <div id="testimonials">
          <TestimonialsSection />
        </div> */}

				{/* New Release Promo */}
				{/* <NewReleasePromo /> */}

				{/* FAQ Section */}
				{/* <div id="faq">
          <FAQSection />
        </div> */}

				{/* 
          ═══════════════════════════════════════════════════════════════
          END OF MASKED SECTIONS
          ═══════════════════════════════════════════════════════════════
        */}
			</div>
		</AuroraBackground>
	)
}
