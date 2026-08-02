import { Providers } from '@/components/providers'
import { fraunces, geist, manrope } from '@/lib/fonts'
import { SITE_URL } from '@/lib/site-config'
import 'katex/dist/katex.min.css'
import type { Metadata } from 'next'
import Script from 'next/script'
import type React from 'react'
import './globals.css'

export const metadata: Metadata = {
	applicationName: 'ForkAI',
	title: {
		default: 'ForkAI – Branch, Compare & Switch AI Models in One Chat',
		template: '%s | ForkAI',
	},
	description:
		'ForkAI is a free multi-AI chat platform with smart branching, seamless model switching, and privacy-first sharing. No credit card required. Start for free.',
	keywords: [
		'AI platform',
		'multi-AI',
		'AI workspace',
		'AI chat platform',
		'branching conversations',
		'AI comparison',
		'ChatGPT alternative',
		'Claude alternative',
		'Claude AI',
		'Gemini',
		'conversation fork',
		'AI chat',
		'free AI chat',
		'AI productivity tool',
	],
	authors: [{ name: 'ForkAI Team' }],
	creator: 'ForkAI',
	publisher: 'ForkAI',
	metadataBase: new URL(SITE_URL),
	openGraph: {
		type: 'website',
		locale: 'en_US',
		url: '/',
		siteName: 'ForkAI',
		title: 'ForkAI – Branch, Compare & Switch AI Models in One Chat',
		description:
			'ForkAI is a free multi-AI chat platform with smart branching, seamless model switching, and privacy-first sharing. No credit card required.',
		images: [
			{
				url: '/opengraph-image',
				width: 1200,
				height: 630,
				alt: 'ForkAI branching conversation workflow for comparing AI models',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'ForkAI – Branch, Compare & Switch AI Models in One Chat',
		description:
			'Free multi-AI chat platform with smart branching. Switch between ChatGPT, Claude, Gemini seamlessly. Start for free.',
		images: ['/opengraph-image'],
		creator: '@forkai',
	},
	// verification: {
	// 	google: process.env.GOOGLE_SITE_VERIFICATION, // Not needed - verified via DNS
	// },
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID?.trim()

	return (
		<html
			lang="en"
			className={`${manrope.variable} ${fraunces.variable} ${geist.variable}`}
			suppressHydrationWarning
		>
			<head>
				{process.env.NODE_ENV === 'development' && (
					<Script
						src="//unpkg.com/react-grab/dist/index.global.js"
						crossOrigin="anonymous"
						strategy="beforeInteractive"
					/>
				)}
				{googleAnalyticsId ? (
					<>
						<Script
							src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
							strategy="afterInteractive"
						/>
						<Script id="google-analytics" strategy="afterInteractive">
							{`
						window.dataLayer = window.dataLayer || [];
						function gtag(){dataLayer.push(arguments);}
						gtag('js', new Date());
						gtag('config', '${googleAnalyticsId}');
					`}
						</Script>
					</>
				) : null}
			</head>
			<body suppressHydrationWarning>
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
