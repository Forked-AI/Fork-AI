/**
 * HOME PAGE - FULL LANDING PAGE
 * This is the main landing page with all sections unmasked.
 */

import { HomePageContent } from '@/components/home-page-content'
import { homepageSchema, JsonLd } from '@/components/json-ld'
import type { Metadata } from 'next'

// SEO: Ensure home page has metadata
export const metadata: Metadata = {
	title: {
		absolute: 'ForkAI | Multi-AI Platform & Branching Conversations',
	},
	description:
		'ForkAI: Multi-AI platform with branching conversations. Compare ChatGPT, Claude, Gemini side-by-side. Fork conversations, explore paths, and unlock AI potential.',
	alternates: {
		canonical: '/',
	},
	openGraph: {
		url: '/',
		title: 'ForkAI | Multi-AI Platform & Branching Conversations',
		description:
			'ForkAI: Multi-AI platform with branching conversations. Compare ChatGPT, Claude, Gemini side-by-side. Fork conversations, explore paths, and unlock AI potential.',
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	},
}

export default function Home() {
	return (
		<>
			<JsonLd data={homepageSchema} />
			<HomePageContent />
		</>
	)
}
