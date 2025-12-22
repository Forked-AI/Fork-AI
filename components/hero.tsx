'use client'
import { Button } from '@/components/ui/button'
import { geist } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { MoveRight, Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const PIXEL_SCRIPT_URL = '/images/pixel.js'

export default function Hero() {
	const [isScriptLoaded, setIsScriptLoaded] = useState(false)
	const [flipIndex, setFlipIndex] = useState(0)
	const flipWords = ['AI', 'Chats', 'Ideas', 'Everything']

	useEffect(() => {
		// Use Intersection Observer to load the script only when the component is in view
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					import('@/lib/load-script').then(({ loadScript }) => {
						loadScript(PIXEL_SCRIPT_URL)
							.then(() => {
								setIsScriptLoaded(true)
							})
							.catch((error) => {
								console.error('Error loading pixel script:', error)
							})
					})
					observer.disconnect()
				}
			},
			{ threshold: 0.1 }
		)

		const heroElement = document.getElementById('hero-section')
		if (heroElement) {
			observer.observe(heroElement)
		}

		return () => {
			observer.disconnect()
		}
	}, [])

	useEffect(() => {
		const flipInterval = setInterval(() => {
			setFlipIndex((prev) => (prev + 1) % flipWords.length)
		}, 2500)

		return () => clearInterval(flipInterval)
	}, [])

	return (
		<div
			id="hero-section"
			className="relative min-h-[80vh] w-full overflow-x-hidden py-32 md:px-6 flex flex-col items-center justify-center"
		>
			<div className="container mx-auto px-4 2xl:max-w-[1400px] relative z-10">
				<motion.div
					className="flex justify-center"
					initial={{ opacity: 0, y: 50 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.75, delay: 0.1 }}
				>
					{/* <HomeBadge /> */}
				</motion.div>
				<div className="mx-auto mt-8 max-w-4xl text-center">
					<motion.h1
						className={cn(
							'text-center text-5xl font-bold tracking-tight text-white sm:text-6xl xl:text-7xl/none',
							geist.className
						)}
						initial={{ opacity: 0, y: 50 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.75, delay: 0.2 }}
					>
						Your AI sucks. <br className="hidden md:block" />
						Fork your{' '}
						<span className="inline-flex items-center justify-center min-w-[140px] md:min-w-[220px]">
							<AnimatePresence mode="wait">
								<motion.span
									key={flipIndex}
									initial={{ rotateX: 90, opacity: 0 }}
									animate={{ rotateX: 0, opacity: 1 }}
									exit={{ rotateX: -90, opacity: 0 }}
									transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
									className="inline-block bg-gradient-to-r from-white via-[#f8fafc] to-white text-black px-4 py-1 rounded-xl transform -rotate-1 shadow-2xl"
									style={{ transformStyle: 'preserve-3d' }}
								>
									{flipWords[flipIndex]}
								</motion.span>
							</AnimatePresence>
						</span>
					</motion.h1>
				</div>
				<motion.div
					className="mx-auto mt-8 max-w-2xl text-center"
					initial={{ opacity: 0, y: 50 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.75, delay: 0.3 }}
				>
					<p className="text-gray-300 text-xl leading-relaxed">
						Fork AI is a powerful multi-AI chat platform and AI workspace.
						Seamlessly switch between ChatGPT, Claude, and Gemini without losing
						context. Branch conversations, organize chats, and start free—no
						credit card required.
					</p>
				</motion.div>
				<motion.div
					className="mt-10 flex flex-col sm:flex-row justify-center gap-4 items-center"
					initial={{ opacity: 0, y: 50 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.75, delay: 0.4 }}
				>
					<Link prefetch={false} href="/prelaunch">
						<Button className="bg-gradient-to-r from-white to-[#f8fafc] text-black hover:from-[#f8fafc] hover:to-white rounded-full px-8 py-6 text-lg font-medium transition-all hover:scale-105 hover:shadow-2xl hover:shadow-white/20 shimmer-hover">
							Get Early Access <MoveRight className="ml-2 h-5 w-5" />
						</Button>
					</Link>
					<Link prefetch={false} href="/demo">
						<Button
							variant="outline"
							className="glass glass-hover border-white/20 text-white rounded-full px-8 py-6 text-lg font-medium group bg-transparent"
						>
							<Play className="mr-2 h-4 w-4 fill-current group-hover:scale-110 transition-transform" />{' '}
							Watch Demo
						</Button>
					</Link>
				</motion.div>
				<motion.div
					className="mt-20 flex flex-col items-center justify-center gap-y-6"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.75, delay: 0.75 }}
				>
					<span className="text-sm text-gray-400 font-medium tracking-wide uppercase">
						Built for people who think in branches
					</span>
					<div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50">
						{[
							'Researchers',
							'Founders',
							'Engineers',
							'PMs',
							'Builders',
							'Creators',
						].map((role, index) => (
							<span
								key={role}
								className="text-xl font-bold text-white/70 cursor-pointer transition-all duration-350 ease-out hover:text-white hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
							>
								{role}
							</span>
						))}
					</div>
				</motion.div>
			</div>
		</div>
	)
}
