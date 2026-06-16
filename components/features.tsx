'use client'

import { geist } from '@/lib/fonts'
import { createRafThrottle } from '@/lib/rate-limit'
import { cn } from '@/lib/utils'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowLeftRight, GitBranch, Share2, Sparkles } from 'lucide-react'
import { useRef } from 'react'

gsap.registerPlugin(ScrollTrigger)

// ── Service tags (offground section-2 style horizontal row) ───────────────
const SERVICE_TAGS = ['Branching', 'Multi-Model', 'Privacy', 'Speed']

// ── Feature steps for Taiko-style pinned narrative ────────────────────────
const STEPS = [
	{
		icon: GitBranch,
		tag: 'Branching UI',
		title: 'Fork your chat,\nnot your brain.',
		body: 'Drag and drop to branch off alternatives, compare responses side-by-side, and keep your main line of thought clean. Each branch is its own thread.',
		visual: (
			<svg
				viewBox="0 0 240 200"
				className="w-full max-w-[220px]"
				aria-hidden="true"
			>
				<line
					x1="120"
					y1="20"
					x2="120"
					y2="80"
					stroke="#cbd5e1"
					strokeWidth="2.5"
					strokeLinecap="round"
				/>
				<line
					x1="120"
					y1="80"
					x2="60"
					y2="140"
					stroke="#94a3b8"
					strokeWidth="2"
					strokeLinecap="round"
				/>
				<line
					x1="120"
					y1="80"
					x2="180"
					y2="140"
					stroke="#94a3b8"
					strokeWidth="2"
					strokeLinecap="round"
				/>
				<line
					x1="60"
					y1="140"
					x2="35"
					y2="185"
					stroke="#64748b"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
				<line
					x1="60"
					y1="140"
					x2="85"
					y2="185"
					stroke="#64748b"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
				<circle cx="120" cy="20" r="10" fill="#cbd5e1" />
				<circle
					cx="120"
					cy="80"
					r="7"
					fill="none"
					stroke="#cbd5e1"
					strokeWidth="2"
				/>
				<circle
					cx="60"
					cy="140"
					r="6"
					fill="none"
					stroke="#94a3b8"
					strokeWidth="1.5"
				/>
				<circle
					cx="180"
					cy="140"
					r="6"
					fill="none"
					stroke="#94a3b8"
					strokeWidth="1.5"
				/>
				<circle
					cx="35"
					cy="185"
					r="5"
					fill="none"
					stroke="#64748b"
					strokeWidth="1.5"
				/>
				<circle
					cx="85"
					cy="185"
					r="5"
					fill="none"
					stroke="#64748b"
					strokeWidth="1.5"
				/>
			</svg>
		),
	},
	{
		icon: Share2,
		tag: 'Privacy-First',
		title: 'Share only what\nmatters.',
		body: 'Instead of dumping your entire chat, share a precise slice: a branch, a set of messages, or an AI summary—with full control over what is visible.',
		visual: (
			<div className="flex flex-col gap-3 w-full max-w-[240px]">
				<div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 flex items-center gap-3">
					<div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
					<span className="text-sm text-white/70">Selected messages</span>
				</div>
				<div className="rounded-xl border border-[#cbd5e1]/30 bg-[#cbd5e1]/10 px-4 py-3 text-sm text-[#cbd5e1]">
					+ AI Summary
				</div>
				<div className="rounded-full bg-white/10 border border-white/20 px-4 py-2 text-xs text-center text-white/50">
					link copied ✓
				</div>
			</div>
		),
	},
	{
		icon: ArrowLeftRight,
		tag: 'Multi-Model',
		title: 'Swap models\nmid-flow.',
		body: 'Different models excel at different tasks. Switch GPT-4, Mistral, or Claude on any branch—compare responses on the same context with zero re-explaining.',
		visual: (
			<div className="flex items-end gap-3 w-full max-w-[240px]">
				{[
					{
						name: 'GPT-4',
						h: 'h-20',
						color: 'from-green-500/25 to-emerald-500/10',
					},
					{
						name: 'Mistral',
						h: 'h-28',
						color: 'from-orange-500/30 to-amber-500/10',
						active: true,
					},
					{
						name: 'Claude',
						h: 'h-16',
						color: 'from-amber-300/25 to-yellow-500/10',
					},
				].map((m) => (
					<div
						key={m.name}
						className={cn(
							'flex-1 rounded-xl border border-white/10 bg-gradient-to-b flex flex-col items-center justify-end pb-3 text-xs font-medium transition-all',
							m.h,
							m.color,
							m.active
								? 'border-orange-400/40 shadow-[0_0_20px_rgba(251,146,60,0.22)]'
								: ''
						)}
					>
						<span className={m.active ? 'text-orange-200' : 'text-white/50'}>
							{m.name}
						</span>
					</div>
				))}
			</div>
		),
	},
	{
		icon: Sparkles,
		tag: 'Accessible',
		title: 'Premium UX,\nzero barrier.',
		body: "Fork AI runs on an ad-supported model so powerful AI stays accessible to everyone—no credit card, no paywall. Start free and upgrade when you're ready.",
		visual: (
			<div className="text-center w-full max-w-[200px]">
				<div className="text-7xl font-black bg-gradient-to-b from-[#cbd5e1] to-[#94a3b8] bg-clip-text text-transparent leading-none">
					$0
				</div>
				<div className="text-white/40 mt-2 text-sm">to get started</div>
				<div className="mt-5 flex flex-col gap-2 text-left text-sm">
					{[
						'Thoughtful, minimal ads',
						'Full branching & sharing',
						'All major AI models',
					].map((i) => (
						<div key={i} className="flex items-center gap-2 text-white/55">
							<div className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1] flex-shrink-0" />
							{i}
						</div>
					))}
				</div>
			</div>
		),
	},
]

export function Features() {
	const containerRef = useRef<HTMLDivElement>(null)
	const narrativeRef = useRef<HTMLDivElement>(null)

	useGSAP(
		() => {
			const mm = gsap.matchMedia()

			mm.add('(min-width: 768px)', () => {
				let cancelNarrativeUpdate: (() => void) | undefined

				// ── 1. Section-2 entrance: slide up FROM BELOW (offground pattern) ──
				// The header tag row reveals horizontally (slides from left, like offground service tags)
				gsap.from('.features-tag-row .ftag', {
					x: -60,
					opacity: 0,
					duration: 0.7,
					ease: 'power3.out',
					stagger: 0.12,
					scrollTrigger: {
						trigger: '.features-tag-row',
						start: 'top 88%',
					},
				})

				// Main headline: clip-path reveal from bottom (offground "We specialize in" style)
				gsap.from('.features-main-headline .clip-line', {
					y: '105%',
					duration: 1.0,
					ease: 'power3.out',
					stagger: 0.12,
					scrollTrigger: {
						trigger: '.features-main-headline',
						start: 'top 85%',
					},
				})

				gsap.from('.features-subtext', {
					y: 30,
					opacity: 0,
					duration: 0.8,
					ease: 'power3.out',
					scrollTrigger: {
						trigger: '.features-subtext',
						start: 'top 88%',
					},
				})

				// ── 2. Taiko-style: PIN the narrative section ─────────────────────────
				const steps = gsap.utils.toArray<HTMLElement>('.step-content')
				const visuals = gsap.utils.toArray<HTMLElement>('.step-visual')

				if (steps.length > 0 && narrativeRef.current) {
					const totalScrollLength = (steps.length - 1) * 600 // 600px scroll per step
					let lastStep = 0

					// Set ALL steps' initial CSS so there's zero bleed-through
					steps.forEach((s, i) =>
						gsap.set(s, {
							opacity: i === 0 ? 1 : 0,
							y: i === 0 ? 0 : 30,
							visibility: i === 0 ? 'visible' : 'hidden',
						})
					)
					visuals.forEach((v, i) =>
						gsap.set(v, {
							opacity: i === 0 ? 1 : 0,
							x: i === 0 ? 0 : 40,
							scale: i === 0 ? 1 : 0.92,
							visibility: i === 0 ? 'visible' : 'hidden',
						})
					)

					const updateNarrativeStep = createRafThrottle(
						(self: ScrollTrigger) => {
							const rawStep = self.progress * (steps.length - 1)
							const currentStep = Math.max(
								0,
								Math.min(steps.length - 1, Math.round(rawStep))
							)
							if (currentStep === lastStep) return
							const prev = lastStep
							lastStep = currentStep

							// Exit old step
							gsap.to(steps[prev], {
								opacity: 0,
								y: prev < currentStep ? -30 : 30,
								duration: 0.35,
								ease: 'power2.in',
								onComplete: () => {
									gsap.set(steps[prev], { visibility: 'hidden' })
								},
							})
							gsap.to(visuals[prev], {
								opacity: 0,
								x: prev < currentStep ? -40 : 40,
								scale: 0.92,
								duration: 0.35,
								ease: 'power2.in',
								onComplete: () => {
									gsap.set(visuals[prev], { visibility: 'hidden' })
								},
							})

							// Enter new step
							gsap.set(steps[currentStep], {
								visibility: 'visible',
								y: prev < currentStep ? 30 : -30,
							})
							gsap.set(visuals[currentStep], {
								visibility: 'visible',
								x: prev < currentStep ? 40 : -40,
							})
							gsap.to(steps[currentStep], {
								opacity: 1,
								y: 0,
								duration: 0.45,
								ease: 'power2.out',
								delay: 0.1,
							})
							gsap.to(visuals[currentStep], {
								opacity: 1,
								x: 0,
								scale: 1,
								duration: 0.5,
								ease: 'power2.out',
								delay: 0.1,
							})
						}
					)
					cancelNarrativeUpdate = updateNarrativeStep.cancel

					ScrollTrigger.create({
						trigger: narrativeRef.current,
						start: 'top top',
						end: `+=${totalScrollLength}`,
						pin: true,
						pinSpacing: true,
						anticipatePin: 1,
						onUpdate: updateNarrativeStep,
					})
				}

				// ── 3. Word-level opacity scroll reveal (Taiko "About" style) ──
				// Applied to features body text
				gsap.utils.toArray<HTMLElement>('.scroll-word').forEach((word) => {
					gsap.fromTo(
						word,
						{ opacity: 0.15 },
						{
							opacity: 1,
							ease: 'none',
							scrollTrigger: {
								trigger: word,
								start: 'top 75%',
								end: 'top 45%',
								scrub: true,
							},
						}
					)
				})

				return () => {
					cancelNarrativeUpdate?.()
				}
			})

			mm.add('(max-width: 767px)', () => {
				gsap.utils.toArray<HTMLElement>('.step-content').forEach((el) => {
					gsap.from(el, {
						y: 40,
						opacity: 0,
						duration: 0.7,
						ease: 'power3.out',
						scrollTrigger: { trigger: el, start: 'top 88%' },
					})
				})
			})

			return () => mm.revert()
		},
		{ scope: containerRef }
	)

	return (
		<section id="features" ref={containerRef} className="relative">
			{/* ── Part A: Offline-style section opener ────────────────────────────── */}
			<div className="px-4 py-16 sm:py-20 lg:py-24">
				<div className="max-w-6xl mx-auto">
					{/* Horizontal service tags — offground "Web Dev · Design · Automation · Consulting" */}
					<div className="features-tag-row flex flex-wrap items-center gap-x-8 gap-y-3 mb-10">
						{SERVICE_TAGS.map((tag) => (
							<div key={tag} className="ftag flex items-center gap-2.5">
								<div className="w-2 h-2 rounded-full bg-[#cbd5e1]/60" />
								<span className="text-sm text-white/55 font-medium tracking-wide">
									{tag}
								</span>
							</div>
						))}
					</div>

					<div className="grid gap-10 lg:grid-cols-[minmax(0,0.98fr)_minmax(320px,0.62fr)] lg:items-center">
						<div className="max-w-2xl">
							{/* Clipping-mask headline reveal — offground "We specialize in customer happiness" */}
							<div className="features-main-headline overflow-hidden mb-6">
								<div className="overflow-hidden">
									<h2
										className={cn(
											'clip-line text-4xl md:text-[56px] md:leading-[1.1] font-bold tracking-tight text-white',
											geist.className
										)}
									>
										What is Fork AI?
									</h2>
								</div>
							</div>

							<div className="features-subtext space-y-5">
								<p className="text-lg leading-relaxed text-white/60">
									Fork AI is a multi-AI chat platform and AI workspace for
									people who need more than one linear conversation. It keeps
									ChatGPT, Claude, Gemini, and other models in one focused place
									so your context stays intact.
								</p>
								<p className="max-w-xl text-base leading-7 text-white/45">
									Branching conversations let you explore alternatives without
									overwriting the original path, compare AI models on the same
									prompt, and share selected context with privacy-first
									controls.
								</p>
							</div>
						</div>

						<div className="relative min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-md">
							<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(203,213,225,0.11),transparent_34%)]" />
							<div
								className="relative min-h-[340px]"
								role="img"
								aria-label="Fork AI workspace illustration showing one prompt branching into research and compare paths, then creating a shareable branch"
							>
								<svg
									viewBox="0 0 420 340"
									className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full sm:block"
									aria-hidden="true"
								>
									<defs>
										<pattern
											id="fork-ai-workflow-grid"
											width="24"
											height="24"
											patternUnits="userSpaceOnUse"
										>
											<path
												d="M24 0H0V24"
												fill="none"
												stroke="rgba(255,255,255,0.035)"
												strokeWidth="1"
											/>
										</pattern>
									</defs>
									<rect
										width="420"
										height="340"
										fill="url(#fork-ai-workflow-grid)"
									/>
								</svg>

								<div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_44%,rgba(125,211,252,0.12),transparent_35%)]" />

								<div className="relative mx-auto flex min-h-[340px] max-w-[420px] flex-col">
									<div className="relative z-20 flex justify-center">
										<div className="w-full max-w-[250px] rounded-2xl border border-white/10 bg-slate-950/75 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
											<div className="mb-3 flex items-center gap-1.5">
												<span className="h-2 w-2 rounded-full bg-white/25" />
												<span className="h-2 w-2 rounded-full bg-white/15" />
												<span className="h-2 w-2 rounded-full bg-white/10" />
											</div>
											<div className="flex items-center gap-3">
												<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-semibold text-white/70">
													AI
												</div>
												<div className="min-w-0 flex-1">
													<div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
														Ask once
													</div>
													<p className="text-sm font-medium text-white/82">
														Plan launch strategy
													</p>
												</div>
											</div>
										</div>
									</div>

									<div className="relative z-10 flex h-5 justify-center">
										<svg
											viewBox="0 0 80 20"
											className="hidden h-full w-20 sm:block"
											aria-hidden="true"
										>
											<defs>
												<linearGradient
													id="fork-ai-prompt-curve"
													x1="40"
													x2="40"
													y1="0"
													y2="20"
													gradientUnits="userSpaceOnUse"
												>
													<stop
														offset="0%"
														stopColor="rgba(203,213,225,0.44)"
													/>
													<stop
														offset="100%"
														stopColor="rgba(125,211,252,0.22)"
													/>
												</linearGradient>
											</defs>
											<path
												d="M40 1C40 8 40 13 40 19"
												fill="none"
												stroke="url(#fork-ai-prompt-curve)"
												strokeLinecap="round"
												strokeWidth="1.5"
											/>
										</svg>
										<div className="h-full w-px bg-gradient-to-b from-[#cbd5e1]/45 to-[#cbd5e1]/18 sm:hidden" />
									</div>

									<div className="relative z-20 flex justify-center">
										<div className="relative flex flex-col items-center gap-1">
											<div className="relative grid h-14 w-14 place-items-center rounded-full border border-[#cbd5e1]/30 bg-slate-950/90 shadow-[0_0_34px_rgba(125,211,252,0.22)]">
												<div className="absolute inset-[-7px] rounded-full border border-[#cbd5e1]/10" />
												<GitBranch className="h-6 w-6 text-[#cbd5e1]" />
											</div>
											<span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
												Fork
											</span>
										</div>
									</div>

									<div className="relative z-10 h-9">
										<svg
											viewBox="0 0 420 36"
											className="hidden h-full w-full sm:block"
											aria-hidden="true"
										>
											<defs>
												<linearGradient
													id="fork-ai-split-curve"
													x1="96"
													x2="324"
													y1="0"
													y2="36"
													gradientUnits="userSpaceOnUse"
												>
													<stop
														offset="0%"
														stopColor="rgba(125,211,252,0.28)"
													/>
													<stop
														offset="50%"
														stopColor="rgba(203,213,225,0.34)"
													/>
													<stop
														offset="100%"
														stopColor="rgba(125,211,252,0.28)"
													/>
												</linearGradient>
											</defs>
											<g
												fill="none"
												stroke="url(#fork-ai-split-curve)"
												strokeLinecap="round"
												strokeWidth="1.75"
											>
												<path d="M210 1C178 14 142 20 96 35" />
												<path d="M210 1C242 14 278 20 324 35" />
											</g>
										</svg>
										<div className="mx-auto h-full w-px bg-[#cbd5e1]/18 sm:hidden" />
									</div>

									<div className="relative z-20 grid w-full gap-5 sm:grid-cols-2">
										<div className="min-h-[118px] min-w-0 rounded-2xl border border-cyan-200/15 bg-slate-950/75 p-3.5 shadow-[0_14px_36px_rgba(8,47,73,0.18)]">
											<div className="mb-3 flex items-center justify-between">
												<div className="flex min-w-0 items-center gap-2">
													<Sparkles className="h-4 w-4 shrink-0 text-cyan-100/75" />
													<span className="text-sm font-semibold text-white/84">
														Research
													</span>
												</div>
												<span className="rounded-full border border-cyan-100/15 px-2 py-0.5 text-[10px] font-medium text-cyan-100/65">
													3 notes
												</span>
											</div>
											<p className="mb-3 text-xs text-white/50">Gather notes</p>
											<div className="mb-3 flex flex-wrap gap-1.5">
												<span className="rounded-md bg-white/8 px-2 py-1 text-[10px] font-medium text-white/52">
													Docs
												</span>
												<span className="rounded-md bg-white/8 px-2 py-1 text-[10px] font-medium text-white/52">
													Market
												</span>
											</div>
											<div className="space-y-1.5">
												<div className="h-2 rounded-full bg-white/18" />
												<div className="h-2 w-4/5 rounded-full bg-white/10" />
												<div className="h-2 w-3/5 rounded-full bg-cyan-100/16" />
											</div>
										</div>

										<div className="min-h-[118px] min-w-0 rounded-2xl border border-sky-200/15 bg-slate-950/75 p-3.5 shadow-[0_14px_36px_rgba(8,47,73,0.16)]">
											<div className="mb-3 flex items-center justify-between">
												<div className="flex min-w-0 items-center gap-2">
													<ArrowLeftRight className="h-4 w-4 shrink-0 text-sky-100/75" />
													<span className="text-sm font-semibold text-white/84">
														Compare
													</span>
												</div>
												<span className="rounded-full border border-sky-100/15 px-2 py-0.5 text-[10px] font-medium text-sky-100/65">
													models
												</span>
											</div>
											<p className="mb-3 text-xs text-white/50">Test models</p>
											<div className="mb-3 grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold">
												<span className="rounded-lg bg-emerald-300/10 px-1.5 py-1.5 text-emerald-100/70">
													GPT
												</span>
												<span className="rounded-lg bg-orange-400/10 px-1.5 py-1.5 text-orange-200/70">
													Mistral
												</span>
												<span className="rounded-lg bg-amber-300/10 px-1.5 py-1.5 text-amber-100/70">
													Claude
												</span>
											</div>
											<div className="space-y-1.5">
												<div className="h-2 rounded-full bg-white/12" />
												<div className="h-2 w-5/6 rounded-full bg-sky-100/16" />
											</div>
										</div>
									</div>

									<div className="relative z-10 h-9">
										<svg
											viewBox="0 0 420 36"
											className="hidden h-full w-full sm:block"
											aria-hidden="true"
										>
											<defs>
												<linearGradient
													id="fork-ai-merge-curve"
													x1="96"
													x2="324"
													y1="0"
													y2="36"
													gradientUnits="userSpaceOnUse"
												>
													<stop
														offset="0%"
														stopColor="rgba(125,211,252,0.16)"
													/>
													<stop
														offset="50%"
														stopColor="rgba(16,185,129,0.34)"
													/>
													<stop
														offset="100%"
														stopColor="rgba(125,211,252,0.16)"
													/>
												</linearGradient>
											</defs>
											<g
												fill="none"
												stroke="url(#fork-ai-merge-curve)"
												strokeLinecap="round"
												strokeWidth="1.75"
											>
												<path d="M96 1C132 18 176 22 210 35" />
												<path d="M324 1C288 18 244 22 210 35" />
											</g>
										</svg>
										<div className="mx-auto h-full w-px bg-gradient-to-b from-emerald-200/18 to-emerald-200/28 sm:hidden" />
									</div>

									<div className="relative z-20 flex justify-center">
										<div className="w-full max-w-[310px] rounded-2xl border border-emerald-200/18 bg-emerald-300/10 p-3.5 shadow-[0_16px_40px_rgba(6,78,59,0.16)]">
											<div className="mb-3 flex items-center gap-2">
												<div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-200/12 text-emerald-100">
													<Share2 className="h-4 w-4" />
												</div>
												<div className="min-w-0">
													<div className="text-sm font-semibold text-emerald-100/82">
														Share selected branch
													</div>
													<div className="text-[11px] text-emerald-100/48">
														Private context stays hidden
													</div>
												</div>
											</div>
											<div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2">
												<span className="h-2 w-12 rounded-full bg-emerald-200/25" />
												<span className="h-2 flex-1 rounded-full bg-white/10" />
												<span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-white/45">
													masked
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ── Part B: Taiko-style pinned narrative (text swaps, visual transitions) ─ */}
			<div
				ref={narrativeRef}
				className="relative h-screen flex items-center overflow-hidden"
			>
				{/* Left: Text steps (overlap each other, shown one at a time) */}
				<div className="absolute inset-0 flex items-center px-4">
					<div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
						{/* Text column */}
						<div className="relative h-72">
							{STEPS.map((step, i) => (
								<div
									key={step.tag}
									className="step-content absolute inset-0 flex flex-col justify-center"
								>
									{/* Step counter */}
									<div className="flex items-center gap-3 mb-5">
										<span className="text-xs font-mono text-white/30 tabular-nums">
											0{i + 1} / 0{STEPS.length}
										</span>
										<div className="flex-1 h-px bg-white/10">
											<div
												className="h-full bg-[#cbd5e1]/60 transition-all duration-500"
												style={{ width: `${((i + 1) / STEPS.length) * 100}%` }}
											/>
										</div>
										<span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#cbd5e1]">
											{step.tag}
										</span>
									</div>

									<h3
										className={cn(
											'text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 whitespace-pre-line',
											geist.className
										)}
									>
										{step.title}
									</h3>

									<p className="text-white/55 text-base leading-relaxed max-w-md">
										{step.body}
									</p>
								</div>
							))}
						</div>

						{/* Visual column */}
						<div className="relative h-72 flex items-center justify-center">
							{STEPS.map((step) => (
								<div
									key={step.tag}
									className="step-visual absolute inset-0 flex items-center justify-center"
								>
									{step.visual}
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Progress dots (taiko-style scroll position indicator) */}
				<div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
					{STEPS.map((step) => (
						<div
							key={step.tag}
							className="w-1.5 h-1.5 rounded-full bg-white/20 transition-all duration-300"
							title={step.tag}
						/>
					))}
				</div>
			</div>
		</section>
	)
}

export default Features
