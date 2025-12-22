import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Login',
	description:
		'Log in to your Fork AI account to access your branching conversations and AI models.',
	robots: {
		index: false,
		follow: false,
	},
}

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
