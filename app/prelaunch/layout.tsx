import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Join the Waitlist - Coming Soon',
	description:
		'Be among the first to experience Fork AI. Join our waitlist and get early access to the revolutionary multi-AI platform with branching conversations.',
	openGraph: {
		title: 'Join the Fork AI Waitlist - Coming Soon',
		description:
			'Be among the first to experience the revolutionary multi-AI platform. Join our waitlist for early access.',
	},
}

export default function PrelaunchLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
