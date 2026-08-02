import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Sign Up',
	description:
		'Create your ForkAI account and start exploring multi-AI conversations with branching capabilities.',
	robots: {
		index: false,
		follow: false,
	},
}

export default function SignupLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
