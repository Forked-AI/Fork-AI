'use client'

import type React from 'react'

import { geist } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { motion, useInView } from 'framer-motion'
import { ArrowLeftRight, GitBranch, Share2, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { FollowerPointerCard } from './ui/following-pointer'

// const ScrambleHover = dynamic(() => import("@/components/ui/scramble").then((mod) => mod.ScrambleHover), { ssr: false })
// const Earth = lazy(() => import("./ui/globe").then((mod) => ({ default: mod.Earth })))

type EarthProps = {
	baseColor: [number, number, number]
	markerColor: [number, number, number]
	glowColor: [number, number, number]
	dark: number
}

const baseColor: EarthProps['baseColor'] = [0.9, 0.9, 0.9]
const glowColor: EarthProps['glowColor'] = [0.58, 0.64, 0.72]
const dark = 1

export function Features() {
	const ref = useRef(null)
	const isInView = useInView(ref, { once: true })
	const [isHovering, setIsHovering] = useState(false)
	const [isCliHovering, setIsCliHovering] = useState(false)
	const [isFeature3Hovering, setIsFeature3Hovering] = useState(false)
	const [isFeature4Hovering, setIsFeature4Hovering] = useState(false)
	const [inputValue, setInputValue] = useState('')

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
		}
	}

	return (
		<section
			id="features"
			className="text-foreground relative overflow-hidden py-12 sm:py-24 md:py-32"
		>
			<div className="bg-primary absolute -top-10 left-1/2 h-16 w-44 -translate-x-1/2 rounded-full opacity-40 blur-3xl select-none"></div>
			<div className="via-primary/50 absolute top-0 left-1/2 h-px w-3/5 -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent transition-all ease-in-out"></div>
			<motion.div
				ref={ref}
				initial={{ opacity: 0, y: 50 }}
				animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
				transition={{ duration: 0.5, delay: 0 }}
				className="container mx-auto flex flex-col items-center gap-6 sm:gap-12"
			>
				<div className="text-center max-w-3xl mx-auto mb-8">
					<h2
						className={cn(
							'mb-4 bg-gradient-to-b from-white to-white/60 bg-clip-text text-center text-4xl font-semibold tracking-tighter text-transparent md:text-[54px] md:leading-[60px]',
							geist.className
						)}
					>
						Why your current AI chat sucks
					</h2>
					<p className="text-white/60 text-lg leading-relaxed">
						Most AI chats trap you in a single, messy thread. You lose track of
						experiments, you cannot safely share context, and switching models
						means starting over. Fork AI fixes this by treating each idea as a
						branch you can grow, prune, and share.
					</p>
				</div>
				<FollowerPointerCard
					title={
						<div className="flex items-center gap-2">
							<span>✨</span>
							<span>Fork AI Features</span>
						</div>
					}
				>
					<div className="cursor-none">
						<div className="grid grid-cols-12 gap-4 justify-center">
							<motion.div
								className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-2"
								onMouseEnter={() => setIsCliHovering(true)}
								onMouseLeave={() => setIsCliHovering(false)}
								ref={ref}
								initial={{ opacity: 0, y: 50 }}
								animate={
									isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }
								}
								transition={{ duration: 0.5, delay: 0.5 }}
								whileHover={{
									scale: 1.02,
									borderColor: 'rgba(148, 163, 184, 0.6)',
									boxShadow: '0 0 30px rgba(148, 163, 184, 0.2)',
								}}
								style={{ transition: 'all 0s ease-in-out' }}
							>
								<div className="flex flex-col gap-4">
									<div className="flex items-center gap-3">
										<GitBranch className="w-8 h-8 text-[#cbd5e1]" />
										<h3 className="text-2xl leading-none font-semibold tracking-tight">
											Fork Branching UI
										</h3>
									</div>
									<div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
										<p className="max-w-[460px]">
											Fork your chat, not your brain. Drag and drop to fork off
											alternatives, compare responses side-by-side, and keep
											your main line of thought clean.
										</p>
									</div>
								</div>
								<div className="pointer-events-none flex grow items-center justify-center select-none relative min-h-[300px]">
									{/* Branching Tree Visualization */}
									<div className="relative w-full h-[300px] flex items-center justify-center">
										<svg
											width="300"
											height="280"
											viewBox="0 0 300 280"
											className="opacity-80"
										>
											{/* Main trunk */}
											<motion.path
												d="M 150 20 L 150 100"
												stroke="#cbd5e1"
												strokeWidth="3"
												fill="none"
												initial={{ pathLength: 0 }}
												animate={
													isCliHovering
														? { pathLength: 1 }
														: { pathLength: 0.5 }
												}
												transition={{ duration: 1 }}
											/>
											{/* Branch left */}
											<motion.path
												d="M 150 100 L 80 160"
												stroke="#94a3b8"
												strokeWidth="2"
												fill="none"
												initial={{ pathLength: 0 }}
												animate={
													isCliHovering ? { pathLength: 1 } : { pathLength: 0 }
												}
												transition={{ duration: 0.8, delay: 0.3 }}
											/>
											{/* Branch right */}
											<motion.path
												d="M 150 100 L 220 160"
												stroke="#94a3b8"
												strokeWidth="2"
												fill="none"
												initial={{ pathLength: 0 }}
												animate={
													isCliHovering ? { pathLength: 1 } : { pathLength: 0 }
												}
												transition={{ duration: 0.8, delay: 0.3 }}
											/>
											{/* Sub branches */}
											<motion.path
												d="M 80 160 L 50 220"
												stroke="#64748b"
												strokeWidth="1.5"
												fill="none"
												initial={{ pathLength: 0 }}
												animate={
													isCliHovering ? { pathLength: 1 } : { pathLength: 0 }
												}
												transition={{ duration: 0.6, delay: 0.6 }}
											/>
											<motion.path
												d="M 80 160 L 110 220"
												stroke="#64748b"
												strokeWidth="1.5"
												fill="none"
												initial={{ pathLength: 0 }}
												animate={
													isCliHovering ? { pathLength: 1 } : { pathLength: 0 }
												}
												transition={{ duration: 0.6, delay: 0.7 }}
											/>
											<motion.path
												d="M 220 160 L 250 220"
												stroke="#64748b"
												strokeWidth="1.5"
												fill="none"
												initial={{ pathLength: 0 }}
												animate={
													isCliHovering ? { pathLength: 1 } : { pathLength: 0 }
												}
												transition={{ duration: 0.6, delay: 0.8 }}
											/>
										</svg>
										{/* Nodes */}
										<motion.div
											className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-[#cbd5e1] to-[#94a3b8] shadow-lg"
											animate={
												isCliHovering ? { scale: [1, 1.2, 1] } : { scale: 1 }
											}
											transition={{ duration: 0.5 }}
										/>
										<motion.div
											className="absolute top-[90px] left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white/20 border-2 border-[#cbd5e1]"
											animate={
												isCliHovering ? { scale: [1, 1.3, 1] } : { scale: 1 }
											}
											transition={{ duration: 0.5, delay: 0.2 }}
										/>
									</div>
								</div>
								<div className="mt-4 flex flex-wrap gap-2">
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Drag-and-drop branching
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Visual tree view
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Focus mode
									</span>
								</div>
							</motion.div>

							<motion.div
								className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-8"
								onMouseEnter={() => setIsHovering(true)}
								onMouseLeave={() => setIsHovering(false)}
								ref={ref}
								initial={{ opacity: 0, y: 50 }}
								animate={
									isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }
								}
								transition={{ duration: 0.5, delay: 0.5 }}
								whileHover={{
									scale: 1.02,
									borderColor: 'rgba(148, 163, 184, 0.6)',
									boxShadow: '0 0 30px rgba(148, 163, 184, 0.2)',
									transition: { duration: 0.3, ease: 'easeOut' },
								}}
							>
								<div className="flex flex-col gap-4">
									<div className="flex items-center gap-3">
										<Share2 className="w-8 h-8 text-[#cbd5e1]" />
										<h3 className="text-2xl leading-none font-semibold tracking-tight">
											Privacy-First Sharing
										</h3>
									</div>
									<div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
										<p className="max-w-[460px]">
											Share only what matters. Instead of dumping your entire
											chat, share a precise slice: a branch, a set of messages,
											or a summary.
										</p>
									</div>
								</div>
								<div className="flex min-h-[300px] grow items-center justify-center select-none">
									<div className="relative">
										<motion.div
											className="glass rounded-xl p-4 border border-white/20"
											animate={isHovering ? { scale: 1.05 } : { scale: 1 }}
											transition={{ duration: 0.3 }}
										>
											<div className="flex items-center gap-2 mb-3">
												<div className="w-3 h-3 rounded-full bg-green-500"></div>
												<span className="text-sm text-white/80">
													Shared Branch
												</span>
											</div>
											<div className="space-y-2">
												<motion.div
													className="bg-white/10 rounded-lg px-3 py-2 text-xs text-white/60"
													animate={isHovering ? { x: [0, 5, 0] } : { x: 0 }}
													transition={{ duration: 0.5, delay: 0.1 }}
												>
													Selected message 1
												</motion.div>
												<motion.div
													className="bg-white/10 rounded-lg px-3 py-2 text-xs text-white/60"
													animate={isHovering ? { x: [0, 5, 0] } : { x: 0 }}
													transition={{ duration: 0.5, delay: 0.2 }}
												>
													Selected message 2
												</motion.div>
												<motion.div
													className="bg-[#cbd5e1]/20 rounded-lg px-3 py-2 text-xs text-[#cbd5e1] border border-[#cbd5e1]/30"
													animate={isHovering ? { x: [0, 5, 0] } : { x: 0 }}
													transition={{ duration: 0.5, delay: 0.3 }}
												>
													+ AI Summary
												</motion.div>
											</div>
										</motion.div>
										<motion.div
											className="absolute -bottom-4 -right-4 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] rounded-full px-3 py-1 text-xs font-medium text-black"
											animate={
												isHovering ? { scale: [1, 1.1, 1] } : { scale: 1 }
											}
											transition={{
												duration: 0.5,
												repeat: isHovering ? Number.POSITIVE_INFINITY : 0,
											}}
										>
											link copied!
										</motion.div>
									</div>
								</div>
								<div className="mt-4 flex flex-wrap gap-2">
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Unique share links
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Redact sensitive info
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Shareable summaries
									</span>
								</div>
							</motion.div>

							<motion.div
								className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-2"
								onMouseEnter={() => setIsFeature3Hovering(true)}
								onMouseLeave={() => setIsFeature3Hovering(false)}
								initial={{ opacity: 0, y: 50 }}
								animate={
									isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }
								}
								transition={{ duration: 0.3 }}
								whileHover={{
									scale: 1.02,
									borderColor: 'rgba(148, 163, 184, 0.5)',
									boxShadow: '0 0 30px rgba(148, 163, 184, 0.2)',
									transition: { duration: 0.3, ease: 'easeOut' },
								}}
							>
								<div className="flex flex-col gap-4">
									<div className="flex items-center gap-3">
										<ArrowLeftRight className="w-8 h-8 text-[#cbd5e1]" />
										<h3 className="text-2xl leading-none font-semibold tracking-tight">
											Swap Models Mid-Flow
										</h3>
									</div>
									<div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
										<p className="max-w-[460px]">
											Different models are good at different things. Switch
											models on any branch or compare responses from multiple
											models on the same context.
										</p>
									</div>
								</div>
								<div className="flex grow items-center justify-center select-none relative min-h-[300px] p-4">
									<div className="flex items-center gap-4">
										{['GPT-4', 'Claude', 'Gemini'].map((model, index) => (
											<motion.div
												key={model}
												className="glass rounded-xl px-4 py-3 border border-white/20 text-center"
												animate={
													isFeature3Hovering
														? {
																y: [0, -10, 0],
																borderColor:
																	index === 1
																		? 'rgba(203, 213, 225, 0.6)'
																		: 'rgba(255, 255, 255, 0.2)',
															}
														: { y: 0 }
												}
												transition={{ duration: 0.5, delay: index * 0.1 }}
											>
												<div className="text-sm font-medium text-white">
													{model}
												</div>
												<div className="text-xs text-white/50 mt-1">
													{index === 0
														? 'Reasoning'
														: index === 1
															? 'Creative'
															: 'Fast'}
												</div>
											</motion.div>
										))}
									</div>
									<motion.div
										className="absolute bottom-8 text-xs text-[#cbd5e1]"
										animate={
											isFeature3Hovering ? { opacity: [0, 1] } : { opacity: 0 }
										}
										transition={{ duration: 0.3, delay: 0.5 }}
									>
										Context preserved across all models
									</motion.div>
								</div>
								<div className="mt-4 flex flex-wrap gap-2">
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Instant switching
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Compare responses
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Keep history
									</span>
								</div>
							</motion.div>

							<motion.div
								className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-8"
								onMouseEnter={() => setIsFeature4Hovering(true)}
								onMouseLeave={() => setIsFeature4Hovering(false)}
								initial={{ opacity: 0, y: 50 }}
								animate={
									isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }
								}
								transition={{ duration: 0.3 }}
								whileHover={{
									scale: 1.02,
									boxShadow: '0 20px 40px rgba(148, 163, 184, 0.3)',
									borderColor: 'rgba(148, 163, 184, 0.6)',
									transition: { duration: 0.3, ease: 'easeOut' },
								}}
							>
								<div className="flex flex-col gap-4">
									<div className="flex items-center gap-3">
										<Sparkles className="w-8 h-8 text-[#cbd5e1]" />
										<h3 className="text-2xl leading-none font-semibold tracking-tight">
											Premium UX, Accessible Pricing
										</h3>
									</div>
									<div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
										<p className="max-w-[460px]">
											Fork AI is built to be accessible. An ad-backed model
											helps keep usage affordable while we invest heavily in UX
											and performance.
										</p>
									</div>
								</div>
								<div className="flex grow items-center justify-center select-none relative min-h-[300px] p-4">
									<div className="text-center">
										<motion.div
											className="text-6xl font-bold bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] bg-clip-text text-transparent"
											animate={
												isFeature4Hovering
													? { scale: [1, 1.1, 1] }
													: { scale: 1 }
											}
											transition={{ duration: 0.5 }}
										>
											$0
										</motion.div>
										<div className="text-white/60 mt-2">to get started</div>
										<div className="mt-6 flex flex-col gap-2 text-left">
											{[
												'Thoughtful, minimal ads',
												'Speed & clarity focused',
												'Built for power users',
											].map((item, i) => (
												<motion.div
													key={item}
													className="flex items-center gap-2 text-sm text-white/80"
													animate={
														isFeature4Hovering ? { x: [0, 5, 0] } : { x: 0 }
													}
													transition={{ duration: 0.3, delay: i * 0.1 }}
												>
													<div className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1]"></div>
													{item}
												</motion.div>
											))}
										</div>
									</div>
								</div>
								<div className="mt-4 flex flex-wrap gap-2">
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Researchers
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Builders
									</span>
									<span className="px-3 py-1 rounded-full glass text-xs text-white/80">
										Power users
									</span>
								</div>
							</motion.div>
						</div>
					</div>
				</FollowerPointerCard>
			</motion.div>
		</section>
	)
}

export default Features
