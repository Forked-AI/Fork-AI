'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionCheckout } from '@/hooks/use-subscription-checkout'
import { cn } from '@/lib/utils'

export type BillingTier = 'free' | 'trial' | 'pro'

interface PricingCardsProps {
	currentTier?: BillingTier | null
	className?: string
}

const pricingPlans = [
	{
		name: 'Free',
		price: 'Free',
		description: 'Ad-supported access to Fork AI',
		features: [
			'Unlimited branching',
			'Basic model access',
			'Share up to 5 branches/month',
			'Community support',
		],
		popular: false,
		cta: 'Get Started',
	},
	{
		name: 'Pro',
		monthlyPrice: 19,
		annualPrice: 15,
		description: 'For power users and researchers',
		features: [
			'Ad-free experience',
			'All AI models (GPT-4, Claude, Gemini)',
			'Unlimited sharing',
			'Priority model access',
			'Advanced summaries',
			'Export conversations',
		],
		popular: true,
		cta: 'Get Pro',
	},
	{
		name: 'Team',
		monthlyPrice: 49,
		annualPrice: 39,
		description: 'For teams collaborating on AI workflows',
		features: [
			'Everything in Pro',
			'Team workspaces',
			'Shared branch libraries',
			'Admin controls',
			'SSO integration',
			'Dedicated support',
		],
		popular: false,
		cta: 'Contact Sales',
	},
] as const

function getCurrentPlanBadge(
	planName: string,
	currentTier: BillingTier | null | undefined
): string | null {
	if (planName === 'Free' && currentTier === 'free') {
		return 'Current Plan'
	}

	if (planName === 'Pro' && currentTier === 'pro') {
		return 'Current Plan'
	}

	if (planName === 'Pro' && currentTier === 'trial') {
		return 'Trial Active'
	}

	return null
}

export function PricingCards({ currentTier = null, className }: PricingCardsProps) {
	const [isAnnual, setIsAnnual] = useState(false)
	const [pendingPlan, setPendingPlan] = useState<string | null>(null)
	const router = useRouter()
	const { session } = useAuth()
	const { startUpgrade, isCheckingOut } = useSubscriptionCheckout()

	const handleCtaClick = async (planName: string) => {
		if (planName === 'Free') {
			router.push('/chat')
			return
		}

		if (planName === 'Pro') {
			if (session) {
				setPendingPlan('Pro')
				try {
					await startUpgrade(isAnnual)
				} catch (error) {
					console.error('Failed to start checkout', error)
				} finally {
					setPendingPlan(null)
				}
			} else {
				const nextParams = new URLSearchParams({
					autostart: 'pro',
					annual: String(isAnnual),
				})
				router.push(
					`/login?next=${encodeURIComponent(`/chat/billing?${nextParams.toString()}`)}`
				)
			}
			return
		}

		window.location.href = 'mailto:hi@fork-ai.com'
	}

	return (
		<div className={cn('space-y-8', className)}>
			<div className="flex items-center justify-center gap-4 p-1 glass rounded-full border-white/10 w-fit mx-auto">
				<button
					onClick={() => setIsAnnual(false)}
					className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
						!isAnnual
							? 'bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black shadow-xl border border-white/10'
							: 'text-white/60 hover:text-white/80 hover:bg-white/5'
					}`}
				>
					Monthly
				</button>
				<button
					onClick={() => setIsAnnual(true)}
					className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 relative ${
						isAnnual
							? 'bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black shadow-xl border border-white/10'
							: 'text-white/60 hover:text-white/80 hover:bg-white/5'
					}`}
				>
					Annual
					<span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full shadow-lg">
						Save 20%
					</span>
				</button>
			</div>

			<div className="grid gap-8 md:grid-cols-3">
				{pricingPlans.map((plan, index) => {
					const badge = getCurrentPlanBadge(plan.name, currentTier)
					const shouldDisableForCurrentPro =
						plan.name === 'Pro' && (currentTier === 'pro' || currentTier === 'trial')
					const isPending =
						pendingPlan === plan.name || (plan.name === 'Pro' && isCheckingOut)

					return (
						<motion.div
							key={plan.name}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
							whileHover={{ y: -8, scale: 1.02 }}
							className={cn(
								'relative rounded-2xl p-8 glass-hover border transition-all duration-300',
								plan.popular
									? 'bg-gradient-to-b from-white/10 to-transparent border-white/20 shadow-2xl shadow-[#cbd5e1]/10'
									: 'bg-white/5 border-white/10 hover:border-white/20',
								badge ? 'border-[#cbd5e1]/40 shadow-[#cbd5e1]/20' : ''
							)}
						>
							{plan.popular && (
								<div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
									<div className="bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black text-sm font-medium px-4 py-2 rounded-full shadow-xl whitespace-nowrap">
										Most Popular
									</div>
								</div>
							)}

							{badge && (
								<div className="absolute top-4 right-4 z-10">
									<span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
										{badge}
									</span>
								</div>
							)}

							<div className="text-center mb-8">
								<h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
								<div className="flex items-baseline justify-center gap-1 mb-2 h-12">
									{'price' in plan ? (
										<span className="text-4xl font-bold text-white">{plan.price}</span>
									) : (
										<AnimatePresence mode="wait">
											<motion.div
												key={isAnnual ? 'annual' : 'monthly'}
												initial={{ opacity: 0, y: 20 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -20 }}
												transition={{ duration: 0.3 }}
												className="flex items-baseline gap-1"
											>
												<span className="text-4xl font-bold text-white">
													${isAnnual ? plan.annualPrice : plan.monthlyPrice}
												</span>
												<span className="text-white/60 text-lg">
													{isAnnual ? '/year' : '/month'}
												</span>
											</motion.div>
										</AnimatePresence>
									)}
								</div>
								<p className="text-white/60 text-sm">{plan.description}</p>
							</div>

							<ul className="space-y-4 mb-8">
								{plan.features.map((feature, featureIndex) => (
									<li key={featureIndex} className="flex items-center gap-3 group">
										<Check className="w-5 h-5 text-[#cbd5e1] flex-shrink-0 transition-transform group-hover:scale-110" />
										<span className="text-white/80 text-sm">{feature}</span>
									</li>
								))}
							</ul>

							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => void handleCtaClick(plan.name)}
								disabled={isPending || shouldDisableForCurrentPro}
								className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 shimmer-hover flex items-center justify-center gap-2 ${
									plan.popular
										? 'bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black shadow-xl shadow-[#cbd5e1]/20 hover:shadow-2xl hover:shadow-[#cbd5e1]/30'
										: 'glass border-white/20 text-white hover:border-white/30 hover:shadow-lg'
								} ${
									isPending || shouldDisableForCurrentPro
										? 'opacity-70 cursor-not-allowed'
										: ''
								}`}
							>
								{isPending ? (
									<>
										<Loader2 className="w-5 h-5 animate-spin" />
										Opening...
									</>
								) : shouldDisableForCurrentPro ? (
									badge
								) : (
									plan.cta
								)}
							</motion.button>
						</motion.div>
					)
				})}
			</div>
		</div>
	)
}
