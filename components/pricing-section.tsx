'use client'

import { useGSAP } from '@gsap/react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { PricingCards, type BillingTier } from '@/components/pricing-cards'
import { useAuth } from '@/contexts/auth-context'

gsap.registerPlugin(ScrollTrigger)

interface BillingStatusResponse {
	plan?: {
		tier?: BillingTier
	}
}

function parseTier(value: unknown): BillingTier | null {
	if (value === 'free' || value === 'trial' || value === 'pro') {
		return value
	}

	return null
}

export function PricingSection() {
	const containerRef = useRef<HTMLElement | null>(null)
	const { session } = useAuth()
	const [currentTier, setCurrentTier] = useState<BillingTier | null>(null)

	useEffect(() => {
		if (!session) {
			setCurrentTier(null)
			return
		}

		const controller = new AbortController()

		const loadBillingStatus = async () => {
			try {
				const response = await fetch('/api/billing/status', {
					method: 'GET',
					credentials: 'include',
					cache: 'no-store',
					signal: controller.signal,
				})

				if (!response.ok) {
					setCurrentTier(null)
					return
				}

				const payload = (await response.json()) as BillingStatusResponse
				setCurrentTier(parseTier(payload.plan?.tier))
			} catch (error) {
				if ((error as { name?: string }).name === 'AbortError') {
					return
				}

				setCurrentTier(null)
			}
		}

		void loadBillingStatus()

		return () => {
			controller.abort()
		}
	}, [session])

	useGSAP(() => {
		// Parallax background orbs
		gsap.to('.pricing-orb-1', {
			y: -150,
			ease: 'none',
			scrollTrigger: {
				trigger: containerRef.current,
				start: 'top bottom',
				end: 'bottom top',
				scrub: 1,
			},
		})

		gsap.to('.pricing-orb-2', {
			y: -250,
			ease: 'none',
			scrollTrigger: {
				trigger: containerRef.current,
				start: 'top bottom',
				end: 'bottom top',
				scrub: 1.5,
			},
		})
	}, { scope: containerRef })

	return (
		<section id="pricing" ref={containerRef} className="relative py-24 px-4 overflow-hidden">
			{/* Ambient Parallax Background Shapes */}
			<div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
				<div className="pricing-orb-1 absolute top-[20%] -left-[10%] w-[40rem] h-[40rem] rounded-full bg-blue-500/10 blur-[100px]" />
				<div className="pricing-orb-2 absolute top-[60%] -right-[10%] w-[35rem] h-[35rem] rounded-full bg-purple-500/10 blur-[100px]" />
			</div>

			<div className="max-w-7xl mx-auto relative z-10">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="text-center mb-16"
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						whileInView={{ opacity: 1, scale: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5 }}
						className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-white/10 mb-6"
					>
						<Sparkles className="w-4 h-4 text-[#cbd5e1]" />
						<span className="text-sm font-medium text-white/80">Pricing</span>
					</motion.div>

					<h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent mb-4">
						ForkAI Pricing – Free, Pro, and Team Plans
					</h2>

					<p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
						Start free with our ad-supported plan, or upgrade for an ad-free
						power user experience. No credit card required.
					</p>

				</motion.div>

				<PricingCards currentTier={currentTier} className="max-w-5xl mx-auto" />

				{/* Bottom CTA */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.4 }}
					className="text-center mt-16"
				>
					<p className="text-white/60 mb-4">
						Need a custom solution? We're here to help.
					</p>
					<motion.button
						whileHover={{ scale: 1.05, x: 5 }}
						whileTap={{ scale: 0.95 }}
						className="text-[#cbd5e1] hover:text-white font-medium transition-all duration-300 relative group"
					>
						Contact our sales team
						<span className="inline-block transition-transform group-hover:translate-x-1">
							→
						</span>
						<div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] transition-all duration-300 group-hover:w-full"></div>
					</motion.button>
				</motion.div>
			</div>
		</section>
	)
}
