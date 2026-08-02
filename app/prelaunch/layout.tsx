import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Join the Waitlist – Free Multi-AI Chat Platform',
	description:
		'Be among the first to experience ForkAI—a free multi-AI chat platform. Switch between ChatGPT, Claude, and Gemini seamlessly. Join the waitlist for early access.',
	alternates: {
		canonical: '/prelaunch',
	},
	robots: {
		index: false,
		follow: true,
	},
	openGraph: {
		url: '/prelaunch',
		title: 'Join the ForkAI Waitlist – Coming Soon',
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
