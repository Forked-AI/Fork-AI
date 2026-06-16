'use client'

import { ThemeApplier } from '@/components/chat/theme-applier'
import { ScrollIndicator } from '@/components/scroll-indicator'
import { SiteHeader } from '@/components/site-header'
import { StickyFooter } from '@/components/sticky-footer'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import type React from 'react'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
	const pathname = usePathname()
	const [queryClient] = useState(() => new QueryClient())
	const isAdminRoute = pathname?.startsWith('/admin')
	const isChatRoute = pathname?.startsWith('/chat')
	const isShareRoute = pathname?.startsWith('/share')
	const shouldHideGlobalChrome = isAdminRoute || isChatRoute || isShareRoute
	const needsFooterClearance = pathname?.startsWith('/branching-ai-chat')

	// Routes with short content that need extra padding for footer
	const shortContentRoutes = ['/signup', '/policy', '/landing', '/login']
	const needsExtraPadding =
		shortContentRoutes.some((path) => pathname?.startsWith(path)) &&
		!shouldHideGlobalChrome

	// Show scroll indicator on pages with footer and potentially short content
	// Note: prelaunch handles its own scroll indicator
	const showScrollIndicator = !shouldHideGlobalChrome && needsExtraPadding
	const mainClassName = [
		needsExtraPadding ? 'min-h-screen pb-96' : '',
		needsFooterClearance && !shouldHideGlobalChrome
			? 'pb-[26rem] md:pb-[24rem]'
			: '',
	]
		.filter(Boolean)
		.join(' ')

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				enableSystem
				disableTransitionOnChange={false}
			>
				<ThemeApplier />
				<AuthProvider>
					{!shouldHideGlobalChrome && <SiteHeader />}
					<main className={mainClassName}>
						{children}
						{showScrollIndicator && <ScrollIndicator />}
					</main>
					{!shouldHideGlobalChrome && <StickyFooter />}
				</AuthProvider>
			</ThemeProvider>
		</QueryClientProvider>
	)
}
