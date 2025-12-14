'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ScrollIndicator() {
	const [isVisible, setIsVisible] = useState(true)

	useEffect(() => {
		const handleScroll = () => {
			const scrollTop = window.scrollY
			const windowHeight = window.innerHeight
			const documentHeight = document.documentElement.scrollHeight

			// Hide indicator after scrolling 100px or near bottom
			const shouldHide =
				scrollTop > 100 || scrollTop + windowHeight >= documentHeight - 200
			setIsVisible(!shouldHide)
		}

		// Check on mount if page is already scrollable
		const documentHeight = document.documentElement.scrollHeight
		const windowHeight = window.innerHeight

		// Only show if page is scrollable
		if (documentHeight <= windowHeight + 100) {
			setIsVisible(false)
		}

		window.addEventListener('scroll', handleScroll, { passive: true })
		handleScroll() // Check initial state

		return () => window.removeEventListener('scroll', handleScroll)
	}, [])

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					transition={{ duration: 0.5, delay: 1 }}
					className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 cursor-pointer"
					onClick={() => {
						window.scrollTo({
							top: document.documentElement.scrollHeight,
							behavior: 'smooth',
						})
					}}
				>
					<motion.div
						className="flex flex-col items-center gap-2 group"
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.9 }}
					>
						{/* Scroll Text */}
						<motion.p
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 1.5 }}
							className="text-white/60 text-sm font-medium group-hover:text-white/80 transition-colors"
						>
							Scroll for more
						</motion.p>

						{/* Animated Chevron Container */}
						<motion.div
							className="relative"
							animate={{
								y: [0, 8, 0],
							}}
							transition={{
								duration: 1.5,
								repeat: Infinity,
								ease: 'easeInOut',
							}}
						>
							{/* Glow effect */}
							<motion.div
								className="absolute inset-0 rounded-full bg-gradient-to-b from-[#cbd5e1]/30 to-[#94a3b8]/30 blur-xl"
								animate={{
									scale: [1, 1.2, 1],
									opacity: [0.5, 0.8, 0.5],
								}}
								transition={{
									duration: 2,
									repeat: Infinity,
									ease: 'easeInOut',
								}}
							/>

							{/* Chevron Icon */}
							<div className="relative glass border-white/20 rounded-full p-3 group-hover:border-white/40 transition-all">
								<ChevronDown className="w-6 h-6 text-[#cbd5e1] group-hover:text-white transition-colors" />
							</div>
						</motion.div>

						{/* Additional animated chevrons for emphasis */}
						<motion.div
							className="absolute top-12"
							animate={{
								y: [0, 12, 0],
								opacity: [0.3, 0.6, 0.3],
							}}
							transition={{
								duration: 1.5,
								repeat: Infinity,
								ease: 'easeInOut',
								delay: 0.2,
							}}
						>
							<ChevronDown className="w-5 h-5 text-[#cbd5e1]/50" />
						</motion.div>

						<motion.div
							className="absolute top-16"
							animate={{
								y: [0, 12, 0],
								opacity: [0.2, 0.4, 0.2],
							}}
							transition={{
								duration: 1.5,
								repeat: Infinity,
								ease: 'easeInOut',
								delay: 0.4,
							}}
						>
							<ChevronDown className="w-4 h-4 text-[#cbd5e1]/30" />
						</motion.div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
