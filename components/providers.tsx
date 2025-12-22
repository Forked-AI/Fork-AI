'use client'

import { ScrollIndicator } from '@/components/scroll-indicator'
import { SiteHeader } from '@/components/site-header'
import { StickyFooter } from '@/components/sticky-footer'
import { usePathname } from 'next/navigation'
import type React from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
	const pathname = usePathname()
	const pathWithoutFooter = ['/admin']
	const shouldHideFooter = pathWithoutFooter.some((path) =>
		pathname?.startsWith(path)
	)
	const isAdminRoute = pathname?.startsWith('/admin')

	// Routes with short content that need extra padding for footer
	const shortContentRoutes = ['/signup', '/policy', '/landing', '/login']
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
	// Note: prelaunch handles its own scroll indicator
	const showScrollIndicator = !shouldHideFooter && needsExtraPadding

	return (
		<>
			{!isAdminRoute && <SiteHeader />}
			<main className={needsExtraPadding ? 'min-h-screen pb-96' : ''}>
				{children}
				{showScrollIndicator && <ScrollIndicator />}
			</main>
			{!shouldHideFooter && <StickyFooter />}
		</>
	)
}
