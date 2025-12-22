import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Privacy Policy & Terms of Service',
	description:
		'Fork AI Privacy Policy and Terms of Service. Learn how we protect your data and your rights when using our multi-AI platform.',
}

export default function PolicyLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
