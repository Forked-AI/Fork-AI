import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Join the Waitlist – Free Multi-AI Chat Platform',
	description:
		'Be among the first to experience Fork AI – a free multi-AI chat platform. Switch between ChatGPT, Claude, and Gemini seamlessly. Join the waitlist for early access.',
	openGraph: {
		title: 'Join the Fork AI Waitlist – Coming Soon',
		description:
			'Get early access to the free multi-AI chat platform. Branch conversations, switch models, and start free.',
	},
}

export default function PrelaunchLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
