'use client'

import { ScrollIndicator } from '@/components/scroll-indicator'
import { SiteHeader } from '@/components/site-header'
import { StickyFooter } from '@/components/sticky-footer'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { usePathname } from 'next/navigation'
import type React from 'react'
import './globals.css'

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const pathname = usePathname()
	const pathWithoutFooter = ['/admin', '/login', '/prelaunch']
	const shouldHideFooter = pathWithoutFooter.some((path) =>
		pathname?.startsWith(path)
	)
	const isAdminRoute = pathname?.startsWith('/admin')

	// Routes with short content that need extra padding for footer
	const shortContentRoutes = ['/signup', '/policy', '/landing, /login']
	const needsExtraPadding =
		shortContentRoutes.some((path) => pathname?.startsWith(path)) &&
		!shouldHideFooter
	console.log(
		'RootLayout: pathname=',
		pathname,
		' needsExtraPadding=',
		needsExtraPadding,
		' shouldHideFooter=',
		shouldHideFooter
	)

	// Show scroll indicator on pages with footer and potentially short content
	const showScrollIndicator = !shouldHideFooter && needsExtraPadding

	return (
		<html lang="en" className="dark">
			<head>
				<title>Fork AI</title>
				<meta name="description" content="Fork AI" />
				<style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
			</head>
			<body className="dark" suppressHydrationWarning>
				{!isAdminRoute && <SiteHeader />}
				<main className={needsExtraPadding ? 'min-h-screen pb-96' : ''}>
					{children}
				</main>
				{showScrollIndicator && <ScrollIndicator />}
				{!shouldHideFooter && <StickyFooter />}
			</body>
		</html>
	)
}
