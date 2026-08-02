import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Privacy Policy & Terms of Service',
	description:
		'ForkAI Privacy Policy and Terms of Service. Learn how we protect your data and your rights when using our multi-AI platform.',
	alternates: {
		canonical: '/policy',
	},
	openGraph: {
		url: '/policy',
		title: 'Privacy Policy & Terms of Service | ForkAI',
		description:
			'Learn how ForkAI handles account data, AI conversations, billing, and your privacy rights.',
	},
}

export default function PolicyLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
