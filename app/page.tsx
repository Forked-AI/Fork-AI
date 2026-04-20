/**
 * HOME PAGE - FULL LANDING PAGE
 * This is the main landing page with all sections unmasked.
 */

import { HomePageContent } from '@/components/home-page-content'
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
	return <HomePageContent />
}
