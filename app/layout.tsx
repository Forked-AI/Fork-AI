import {
	JsonLd,
	organizationSchema,
	productSchema,
	softwareApplicationSchema,
} from '@/components/json-ld'
import { Providers } from '@/components/providers'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import Script from 'next/script'
import type React from 'react'
import './globals.css'

export const metadata: Metadata = {
	title: {
		default: 'Fork AI – Branch, Compare & Switch AI Models in One Chat',
		template: '%s | Fork AI',
	},
	description:
		'Fork AI is a free multi-AI chat platform with smart branching, seamless model switching, and privacy-first sharing. No credit card required. Start for free.',
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
	authors: [{ name: 'Fork AI Team' }],
	creator: 'Fork AI',
	publisher: 'Fork AI',
	metadataBase: new URL(
		(process.env.NEXT_PUBLIC_BASE_URL || 'https://forkai.tech').trim()
	),
	alternates: {
		canonical: '/',
	},
	openGraph: {
		type: 'website',
		locale: 'en_US',
		url: '/',
		siteName: 'Fork AI',
		title: 'Fork AI – Branch, Compare & Switch AI Models in One Chat',
		description:
			'Fork AI is a free multi-AI chat platform with smart branching, seamless model switching, and privacy-first sharing. No credit card required.',
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
		title: 'Fork AI – Branch, Compare & Switch AI Models in One Chat',
		description:
			'Free multi-AI chat platform with smart branching. Switch between ChatGPT, Claude, Gemini seamlessly. Start for free.',
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
	// verification: {
	// 	google: process.env.GOOGLE_SITE_VERIFICATION, // Not needed - verified via DNS
	// },
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang="en"
			className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
		>
			<head>
				<JsonLd data={organizationSchema} />
				<JsonLd data={softwareApplicationSchema} />
				<JsonLd data={productSchema} />
				<Script
					src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
					strategy="afterInteractive"
				/>
				<Script id="google-analytics" strategy="afterInteractive">
					{`
						window.dataLayer = window.dataLayer || [];
						function gtag(){dataLayer.push(arguments);}
						gtag('js', new Date());
						gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
					`}
				</Script>
			</head>
			<body className="dark" suppressHydrationWarning>
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
