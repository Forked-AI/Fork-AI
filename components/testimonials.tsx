'use client'

import Image from 'next/image'
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { cn } from '@/lib/utils'
import { geist } from '@/lib/fonts'

gsap.registerPlugin(ScrollTrigger)

const testimonials = [
	{
		name: 'Dr. Sarah Chen',
		username: '@sarahresearch',
		body: 'Fork AI completely changed how I explore research hypotheses. I can branch off multiple interpretations of a paper and compare them side-by-side.',
		img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face',
		role: 'Research Scientist',
	},
	{
		name: 'Marcus Thompson',
		username: '@marcuspm',
		body: 'As a PM, I use Fork AI to compare product directions in parallel. The branching UI is exactly how my brain works when evaluating options.',
		img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
		role: 'Product Manager',
	},
	{
		name: 'Elena Rodriguez',
		username: '@elenabuilds',
		body: "Finally, an AI chat that doesn't trap me in a single messy thread. The privacy-first sharing is a game changer for client work.",
		img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
		role: 'Freelance Engineer',
	},
	{
		name: 'James Liu',
		username: '@jamescodes',
		body: "Testing prompts across GPT-4, Claude, and Gemini on the same context without re-explaining everything? This is what I've been waiting for.",
		img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
		role: 'AI Engineer',
	},
	{
		name: 'Priya Patel',
		username: '@priyafounder',
		body: "Fork AI's branching lets me explore multiple startup pivots simultaneously. Each idea gets its own thread without losing the main vision.",
		img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
		role: 'Founder',
	},
	{
		name: 'Michael Chang',
		username: '@michaelbuilds',
		body: "Fork AI's UX is genuinely premium. The ad-backed model means I can use powerful AI without breaking the bank. Smart approach.",
		img: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
		role: 'Indie Builder',
	},
]

export function TestimonialsSection() {
	const containerRef = useRef<HTMLDivElement>(null)

	useGSAP(() => {
		const mm = gsap.matchMedia()

		mm.add('(min-width: 768px)', () => {
			// Heading slides in
			gsap.from('.testimonials-heading', {
				y: 50,
				opacity: 0,
				duration: 1,
				ease: 'power3.out',
				scrollTrigger: {
					trigger: '.testimonials-heading',
					start: 'top 85%',
				},
			})

			// Cards stagger in from below as user scrolls into each
			gsap.utils.toArray<HTMLElement>('.tcard').forEach((card, i) => {
				gsap.fromTo(
					card,
					{
						y: 80,
						opacity: 0,
						scale: 0.95,
					},
					{
						y: 0,
						opacity: 1,
						scale: 1,
						duration: 0.9,
						ease: 'power3.out',
						scrollTrigger: {
							trigger: card,
							start: 'top 88%',
							toggleActions: 'play none none reverse',
						},
						delay: (i % 3) * 0.1,
					}
				)
			})

			return () => mm.revert()
		})

		mm.add('(max-width: 767px)', () => {
			gsap.utils.toArray<HTMLElement>('.tcard').forEach((card) => {
				gsap.from(card, {
					y: 40,
					opacity: 0,
					duration: 0.6,
					ease: 'power3.out',
					scrollTrigger: {
						trigger: card,
						start: 'top 90%',
					},
				})
			})
		})
	}, { scope: containerRef })

	return (
		<section
			id="testimonials"
			ref={containerRef}
			className="relative py-24 px-4 overflow-hidden"
		>
			{/* Background glow */}
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60rem] h-[40rem] rounded-full bg-indigo-500/5 blur-[120px]" />
			</div>

			<div className="max-w-6xl mx-auto relative z-10">
				{/* Header */}
				<div className="testimonials-heading text-center mb-16">
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 mb-6">
						<span className="text-sm font-medium text-white/80">Testimonials</span>
					</div>
					<h2
						className={cn(
							'text-4xl md:text-[54px] md:leading-[60px] font-semibold tracking-tighter bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent',
							geist.className
						)}
					>
						What our users say
					</h2>
					<p className="mt-4 text-white/50 text-lg max-w-xl mx-auto">
						From researchers to founders, Fork AI is reshaping how people use AI.
					</p>
				</div>

				{/* Masonry-style grid of testimonial cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
					{testimonials.map((t, i) => (
						<div
							key={t.username}
							className={cn(
								'tcard relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 overflow-hidden group transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:-translate-y-1',
								// Stagger the vertical offset for visual interest
								i % 3 === 1 ? 'md:mt-8' : ''
							)}
						>
							{/* Subtle top glow on hover */}
							<div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-8 rounded-full bg-white/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />

							{/* Quote */}
							<p className="text-white/75 leading-relaxed text-sm mb-5 relative z-10">
								"{t.body}"
							</p>

							{/* Author */}
							<div className="flex items-center gap-3 relative z-10">
								<Image
									src={t.img}
									alt={t.name}
									height={40}
									width={40}
									className="h-10 w-10 rounded-full ring-2 ring-white/10 group-hover:ring-white/25 transition-all"
								/>
								<div>
									<div className="text-sm font-medium text-white">{t.name}</div>
									<div className="text-xs text-white/40">{t.role}</div>
								</div>
							</div>
						</div>
					))}
				</div>

				{/* Bottom CTA */}
				<div className="mt-12 flex justify-center">
					<button className="group relative inline-flex items-center gap-2 rounded-full border border-white/20 glass px-6 py-3 text-sm font-medium text-white transition-all hover:border-white/30 hover:shadow-xl hover:scale-105 active:scale-95">
						<div className="absolute inset-x-0 -top-px mx-auto h-px w-3/4 bg-gradient-to-r from-transparent via-[#cbd5e1] to-transparent" />
						Share your experience →
					</button>
				</div>
			</div>
		</section>
	)
}
