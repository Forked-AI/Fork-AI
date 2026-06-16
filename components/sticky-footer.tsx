'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { GitBranch } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export function StickyFooter() {
	const [isAtBottom, setIsAtBottom] = useState(false)
	const [hasScrolled, setHasScrolled] = useState(false)

	useEffect(() => {
		let ticking = false

		const handleScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					const scrollTop = window.scrollY
					const windowHeight = window.innerHeight
					const documentHeight = document.documentElement.scrollHeight

					// User must scroll at least 50px before we consider showing the footer
					if (scrollTop > 50) {
						setHasScrolled(true)
					}

					const isNearBottom = scrollTop + windowHeight >= documentHeight - 100

					// Only show footer if user has scrolled AND is near bottom
					setIsAtBottom(hasScrolled && isNearBottom)
					ticking = false
				})
				ticking = true
			}
		}

		window.addEventListener('scroll', handleScroll, { passive: true })
		// Don't call handleScroll on mount - wait for actual scroll
		return () => window.removeEventListener('scroll', handleScroll)
	}, [hasScrolled])

	return (
		<AnimatePresence>
			{isAtBottom && (
				<motion.footer
					className="fixed z-50 bottom-0 left-0 w-full h-80 flex justify-center items-center glass"
					style={{
						background:
							'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 20, 25, 0.98) 100%)',
						boxShadow: '0 -8px 32px rgba(226, 232, 240, 0.1)',
					}}
					initial={{ y: '100%' }}
					animate={{ y: 0 }}
					exit={{ y: '100%' }}
					transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
				>
					<div className="relative overflow-hidden w-full h-full flex justify-end px-12 text-right items-start py-12">
						<div className="absolute inset-0 shimmer"></div>

						<motion.nav
							aria-label="Footer links"
							className="flex flex-row space-x-12 sm:space-x-16 md:space-x-24 text-sm sm:text-lg md:text-xl relative z-10"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.1 }}
						>
							<ul className="space-y-2">
								<li>
									<Link
										href="/"
										className="text-[#cbd5e1] transition-all duration-300 hover:text-white hover:translate-x-1 inline-block"
									>
										Home
									</Link>
								</li>
								<li>
									<Link
										href="/landing#features"
										className="text-[#cbd5e1] transition-all duration-300 hover:text-white hover:translate-x-1 inline-block"
									>
										Features
									</Link>
								</li>
								<li>
									<Link
										href="/landing#pricing"
										className="text-[#cbd5e1] transition-all duration-300 hover:text-white hover:translate-x-1 inline-block"
									>
										Pricing
									</Link>
								</li>
								<li>
									<Link
										href="/branching-ai-chat"
										className="text-[#cbd5e1] transition-all duration-300 hover:text-white hover:translate-x-1 inline-block"
									>
										Branching AI Chat
									</Link>
								</li>
							</ul>
							<ul className="space-y-2">
								<li>
									<a
										href="https://twitter.com/forkai"
										target="_blank"
										rel="noreferrer noopener"
										className="text-[#cbd5e1] transition-all duration-300 hover:text-white hover:translate-x-1 inline-block"
									>
										Twitter
									</a>
								</li>
								<li>
									<span className="text-[#94a3b8]">Discord (soon)</span>
								</li>
								<li>
									<Link
										href="/policy"
										className="text-[#cbd5e1] transition-all duration-300 hover:text-white hover:translate-x-1 inline-block"
									>
										Privacy
									</Link>
								</li>
							</ul>
						</motion.nav>

						<motion.div
							className="absolute bottom-4 left-8 flex items-center gap-3"
							initial={{ opacity: 0, x: -100 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.8, delay: 0.3 }}
						>
							<GitBranch className="w-12 h-12 sm:w-16 sm:h-16 text-[#64748b]" />
							<span className="text-[60px] sm:text-[100px] font-bold select-none bg-gradient-to-t from-[#475569] to-[#64748b] bg-clip-text text-transparent">
								Fork AI
							</span>
						</motion.div>
					</div>
				</motion.footer>
			)}
		</AnimatePresence>
	)
}
