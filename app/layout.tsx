import {
	JsonLd,
	organizationSchema,
	softwareApplicationSchema,
} from '@/components/json-ld'
import { Providers } from '@/components/providers'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import type React from 'react'
import './globals.css'

export const metadata: Metadata = {
	title: {
		default: 'Fork AI | Multi-AI Platform & Branching Conversations',
		template: '%s | Fork AI',
	},
	description:
		'Fork AI: Multi-AI platform with branching conversations. Compare ChatGPT, Claude, Gemini side-by-side. Fork conversations, explore paths, and unlock AI potential.',
	keywords: [
		'AI platform',
		'multi-AI',
		'branching conversations',
		'AI comparison',
		'ChatGPT alternative',
		'Claude AI',
		'Gemini',
		'conversation fork',
		'AI chat',
	],
	authors: [{ name: 'Fork AI Team' }],
	creator: 'Fork AI',
	publisher: 'Fork AI',
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_BASE_URL || 'https://fork-ai.com'
	),
	openGraph: {
		type: 'website',
		locale: 'en_US',
		url: '/',
		siteName: 'Fork AI',
		title: 'Fork AI | Multi-AI Platform & Branching Conversations',
		description:
			'Compare ChatGPT, Claude, Gemini side-by-side. Fork conversations, explore paths, and unlock AI potential with branching conversations.',
		images: [
			{
				url: '/opengraph-image',
				width: 1200,
				height: 630,
				alt: 'Fork AI - Multi-AI Platform',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Fork AI | Multi-AI Platform & Branching Conversations',
		description:
			'Compare ChatGPT, Claude, Gemini side-by-side. Fork conversations, explore paths, and unlock AI potential.',
		images: ['/opengraph-image'],
		creator: '@forkai',
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
	verification: {
		// Add your verification codes here when ready
		// google: 'your-google-verification-code',
		// yandex: 'your-yandex-verification-code',
	},
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
			<head>
				<JsonLd data={organizationSchema} />
				<JsonLd data={softwareApplicationSchema} />
			</head>
			<body className="dark" suppressHydrationWarning>
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
