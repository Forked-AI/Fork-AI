'use client'

import { geist } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
	Code2,
	FlaskConical,
	Lightbulb,
	PenTool,
	Search,
	Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRef } from 'react'

gsap.registerPlugin(ScrollTrigger)

const useCases = [
	{
		title: 'Research teams',
		body: 'Keep competing hypotheses in separate branches, compare model responses against the same evidence, and share a focused summary with collaborators.',
		icon: FlaskConical,
	},
	{
		title: 'Product teams',
		body: 'Explore alternate requirements, edge cases, and rollout plans without overwriting the assumptions captured in the original product thread.',
		icon: Users,
	},
	{
		title: 'Engineers',
		body: 'Compare implementation paths from ChatGPT, Claude, and Gemini on one source prompt, preserve rejected approaches, and hand reviewers the branch that contains the final rationale.',
		icon: Code2,
	},
	{
		title: 'Founders',
		body: 'Test positioning, customer objections, and launch scenarios in parallel while keeping the core company context attached to every path.',
		icon: Lightbulb,
	},
	{
		title: 'Creators',
		body: 'Develop concepts, outlines, and revisions as distinct branches so promising directions stay available when the brief changes.',
		icon: PenTool,
	},
	{
		title: 'Analysts',
		body: 'Separate evidence gathering from interpretation, compare specialist models, and publish only the conclusions and context a reader needs.',
		icon: Search,
	},
] as const

export function TestimonialsSection() {
	const containerRef = useRef<HTMLDivElement>(null)

	useGSAP(
		() => {
			const mm = gsap.matchMedia()

			mm.add('(min-width: 768px)', () => {
				gsap.from('.use-cases-heading', {
					y: 50,
					opacity: 0,
					duration: 0.8,
					ease: 'power3.out',
					scrollTrigger: {
						trigger: '.use-cases-heading',
						start: 'top 85%',
					},
				})

				gsap.utils.toArray<HTMLElement>('.use-case-card').forEach((card, i) => {
					gsap.fromTo(
						card,
						{ y: 56, opacity: 0, scale: 0.97 },
						{
							y: 0,
							opacity: 1,
							scale: 1,
							duration: 0.7,
							delay: i * 0.04,
							ease: 'power3.out',
							scrollTrigger: { trigger: card, start: 'top 92%' },
						}
					)
				})
			})

			return () => mm.revert()
		},
		{ scope: containerRef }
	)

	return (
		<section
			id="testimonials"
			ref={containerRef}
			className="relative overflow-hidden px-4 py-24"
		>
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute left-1/2 top-1/2 h-[40rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-[120px]" />
			</div>

			<div className="relative z-10 mx-auto max-w-6xl">
				<div className="use-cases-heading mb-16 text-center">
					<div className="glass mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2">
						<span className="text-sm font-medium text-white/80">Use cases</span>
					</div>
					<h2
						className={cn(
							'bg-gradient-to-b from-white to-white/60 bg-clip-text text-4xl font-semibold tracking-tighter text-transparent md:text-[54px] md:leading-[60px]',
							geist.className
						)}
					>
						How teams use branching AI chat
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-white/50">
						ForkAI keeps alternate paths organized for work that needs
						comparison, review, and selective sharing.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
					{useCases.map((useCase, i) => {
						const Icon = useCase.icon

						return (
							<article
								key={useCase.title}
								className={cn(
									'use-case-card glass-hover group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]',
									i % 3 === 1 ? 'md:mt-8' : ''
								)}
							>
								<div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-200">
									<Icon className="h-5 w-5" aria-hidden="true" />
								</div>
								<h3 className="text-lg font-semibold text-white">
									{useCase.title}
								</h3>
								<p className="mt-3 text-sm leading-7 text-white/65">
									{useCase.body}
								</p>
							</article>
						)
					})}
				</div>

				<div className="mt-12 flex justify-center">
					<Link
						href="/prelaunch"
						className="glass group relative inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition-all hover:scale-105 hover:border-white/30 hover:shadow-xl"
					>
						Join early access →
					</Link>
				</div>
			</div>
		</section>
	)
}
