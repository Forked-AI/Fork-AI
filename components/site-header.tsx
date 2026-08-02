/**
 * SITE HEADER - PRELAUNCH CONFIGURATION
 * Navigation links point to /landing route during prelaunch phase.
 *
 * SEE: docs/operations/launch/PRELAUNCH-RESTORATION.md for restoration instructions when ready to launch.
 */

'use client'

import { authClient } from '@/lib/auth-client'
import { createRafThrottle } from '@/lib/rate-limit'
import { GitBranch } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function SiteHeader() {
	const [isScrolled, setIsScrolled] = useState(false)
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
	const lastScrollYRef = useRef(0)
	const [session, setSession] = useState<any>(null)
	const pathname = usePathname()

	useEffect(() => {
		const getSession = async () => {
			try {
				const { data } = await authClient.getSession()
				setSession(data)
			} catch (error) {
				console.error('Failed to get session:', error)
			}
		}
		getSession()
	}, [])

	// Check if on landing page (where sections exist) during prelaunch
	const isHomePage = pathname === '/' || pathname === '/landing'

	useEffect(() => {
		const handleScroll = createRafThrottle(() => {
			const currentScrollY = window.scrollY

			// Always expand at the very top
			if (currentScrollY < 50) {
				setIsScrolled(false)
			}
			// Scrolling down - shrink the header
			else if (
				currentScrollY > lastScrollYRef.current &&
				currentScrollY > 100
			) {
				setIsScrolled(true)
			}
			// Scrolling up - expand the header
			else if (currentScrollY < lastScrollYRef.current) {
				setIsScrolled(false)
			}

			lastScrollYRef.current = currentScrollY
		})

		window.addEventListener('scroll', handleScroll, { passive: true })
		return () => {
			window.removeEventListener('scroll', handleScroll)
			handleScroll.cancel()
		}
	}, [])

	const handleNavClick = (elementId: string) => {
		setIsMobileMenuOpen(false)

		if (isHomePage) {
			const element = document.getElementById(elementId)
			if (element) {
				const headerOffset = 120
				const elementPosition =
					element.getBoundingClientRect().top + window.pageYOffset
				const offsetPosition = elementPosition - headerOffset

				window.scrollTo({
					top: offsetPosition,
					behavior: 'smooth',
				})
			}
		}
		// If not on home page, the Link component handles navigation to /#elementId.
	}

	const navItems = [
		{ name: 'Features', id: 'features' },
		{ name: 'Pricing', id: 'pricing' },
		{ name: 'Use Cases', id: 'testimonials' },
		{ name: 'FAQ', id: 'faq' },
	]

	// Hide the marketing header on standalone app/public-share routes.
	if (pathname?.startsWith('/chat') || pathname?.startsWith('/share')) {
		return null
	}

	return (
		<>
			{/* Desktop Header */}
			<header
				className={`fixed top-2 left-1/2 -translate-x-1/2 z-[9999] hidden w-[calc(100%-2rem)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-full glass border-white/20 shadow-2xl shadow-[#cbd5e1]/10 transition-all duration-300 ease-out md:grid ${
					isScrolled
						? 'max-w-3xl px-3 py-1.5 scale-[0.98]'
						: 'max-w-5xl px-4 py-2'
				}`}
				style={{
					willChange: 'transform',
					backfaceVisibility: 'hidden',
					perspective: '1000px',
				}}
			>
				<Link
					className="z-50 flex shrink-0 items-center justify-center gap-2 transition-all duration-300"
					href="/"
				>
					<GitBranch className="w-8 h-8 text-white" />
					<span className="font-bold text-white text-lg">ForkAI</span>
				</Link>

				<nav
					aria-label="Primary"
					className={`min-w-0 flex flex-row items-center justify-center text-sm font-medium text-muted-foreground transition duration-200 hover:text-foreground ${
						isScrolled ? 'space-x-0' : 'space-x-2'
					}`}
				>
					{navItems.map((item) => (
						<Link
							key={item.id}
							href={`/#${item.id}`}
							className={`relative py-2 text-muted-foreground hover:text-white transition-all cursor-pointer group ${
								isScrolled ? 'px-1.5' : 'px-3'
							}`}
							onClick={(e) => {
								if (isHomePage) {
									e.preventDefault()
									handleNavClick(item.id)
								}
							}}
						>
							<span className="relative z-20">{item.name}</span>
							<span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
						</Link>
					))}
				</nav>

				<div className="z-50 flex shrink-0 items-center gap-3">
					{session ? (
						<div className="flex items-center gap-3">
							<span
								className={`max-w-32 truncate text-sm text-white ${
									isScrolled ? 'hidden' : 'hidden xl:block'
								}`}
								title={`Welcome, ${session.user.name}`}
							>
								Welcome, {session.user.name}
							</span>
							<Link
								href="/chat"
								className={`relative inline-block cursor-pointer rounded-full bg-gradient-to-r from-[#e2e8f0] to-white py-2 text-center text-sm font-bold text-black shadow-xl shadow-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-white/30 shimmer-hover ${
									isScrolled ? 'px-4' : 'px-5'
								}`}
							>
								Open Chat
							</Link>
							<button
								onClick={async () => {
									try {
										await authClient.signOut()
										// Refresh session state
										setSession(null)
										// Redirect to home page
										window.location.href = '/'
									} catch (error) {
										console.error('Failed to logout:', error)
									}
								}}
								className="font-medium text-muted-foreground text-sm cursor-pointer transition-all duration-200 hover:text-white hover:scale-105 relative group"
							>
								Log Out
								<span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
							</button>
						</div>
					) : (
						<>
							<Link
								href="/login"
								prefetch={false}
								className="font-medium text-muted-foreground text-sm cursor-pointer transition-all duration-200 hover:text-white hover:scale-105 relative group"
							>
								Log In
								<span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></span>
							</Link>

							<Link
								href="/prelaunch"
								className="rounded-full font-bold relative cursor-pointer hover:-translate-y-0.5 transition-all duration-200 inline-block text-center bg-gradient-to-r from-[#e2e8f0] to-white text-black shadow-xl shadow-white/20 hover:shadow-2xl hover:shadow-white/30 px-6 py-2 text-sm shimmer-hover"
							>
								Get Early Access
							</Link>
						</>
					)}
				</div>
			</header>

			{/* Mobile Header */}
			<header className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] mx-4 flex w-[calc(100%-2rem)] flex-row items-center justify-between rounded-full glass border-white/20 shadow-2xl md:hidden px-4 py-3">
				<Link className="flex items-center justify-center gap-2" href="/">
					<GitBranch className="w-7 h-7 text-white" />
					<span className="font-bold text-white">ForkAI</span>
				</Link>

				<button
					onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
					className="flex items-center justify-center w-10 h-10 rounded-full glass glass-hover border-white/20 transition-colors"
					aria-label="Toggle menu"
				>
					<div className="flex flex-col items-center justify-center w-5 h-5 space-y-1">
						<span
							className={`block w-4 h-0.5 bg-foreground transition-all duration-300 ${
								isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
							}`}
						></span>
						<span
							className={`block w-4 h-0.5 bg-foreground transition-all duration-300 ${
								isMobileMenuOpen ? 'opacity-0' : ''
							}`}
						></span>
						<span
							className={`block w-4 h-0.5 bg-foreground transition-all duration-300 ${
								isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
							}`}
						></span>
					</div>
				</button>
			</header>

			{/* Mobile Menu Overlay */}
			{isMobileMenuOpen && (
				<div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-md md:hidden">
					<div className="absolute top-20 left-4 right-4 glass border-white/20 rounded-2xl shadow-2xl p-6 shimmer">
						<nav className="flex flex-col space-y-4">
							{navItems.map((item) => (
								<Link
									key={item.id}
									href={`/#${item.id}`}
									onClick={(e) => {
										if (isHomePage) {
											e.preventDefault()
											handleNavClick(item.id)
										} else {
											setIsMobileMenuOpen(false)
										}
									}}
									className="text-left px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 hover:translate-x-2"
								>
									{item.name}
								</Link>
							))}
							<div className="border-t border-white/10 pt-4 mt-4 flex flex-col space-y-3">
								{session ? (
									<>
										<span className="px-4 py-3 text-lg font-medium text-white">
											Welcome, {session.user.name}
										</span>
										<Link
											href="/chat"
											onClick={() => setIsMobileMenuOpen(false)}
											className="px-4 py-3 text-lg font-bold text-center bg-gradient-to-r from-[#e2e8f0] to-white text-black rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200"
										>
											Open Chat
										</Link>
										<button
											onClick={async () => {
												try {
													await authClient.signOut()
													// Close mobile menu and refresh session
													setIsMobileMenuOpen(false)
													setSession(null)
													// Redirect to home page
													window.location.href = '/'
												} catch (error) {
													console.error('Failed to logout:', error)
												}
											}}
											className="px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 cursor-pointer"
										>
											Log Out
										</button>
									</>
								) : (
									<>
										<Link
											href="/login"
											className="px-4 py-3 text-lg font-medium text-muted-foreground hover:text-white transition-all rounded-lg hover:bg-white/10 cursor-pointer"
										>
											Login
										</Link>
										<Link
											href="/prelaunch"
											className="px-4 py-3 text-lg font-bold text-center bg-gradient-to-r from-[#e2e8f0] to-white text-black rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200"
										>
											Get Early Access
										</Link>
									</>
								)}
							</div>
						</nav>
					</div>
				</div>
			)}
		</>
	)
}
