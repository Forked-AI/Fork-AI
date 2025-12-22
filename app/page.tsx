/**
 * PRELAUNCH REDIRECT
 * This page temporarily redirects to /prelaunch during the prelaunch phase.
 * The full landing page with all sections is available at /landing (with sections masked).
 *
 * SEE: PRELAUNCH-RESTORATION.md for restoration instructions when ready to launch.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

// SEO: Ensure home page has metadata even when redirecting
export const metadata: Metadata = {
	title: 'Fork AI | Multi-AI Platform & Branching Conversations',
	description:
		'Fork AI: Multi-AI platform with branching conversations. Compare ChatGPT, Claude, Gemini side-by-side. Fork conversations, explore paths, and unlock AI potential.',
	alternates: {
		canonical: '/',
	},
}

export default function Home() {
	// Redirect to prelaunch page during prelaunch phase
	redirect('/prelaunch')
}
