'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { useState } from 'react'

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
		cta: 'Start Free Trial',
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
]

export function PricingSection() {
	const [isAnnual, setIsAnnual] = useState(false)

	return (
		<section className="relative py-24 px-4">
			<div className="max-w-7xl mx-auto">
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
						Premium UX, accessible pricing
					</h2>

					<p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
						Fork AI is built to be accessible. Start free with ads, or upgrade
						for an ad-free power user experience.
					</p>

					{/* Monthly/Annual Toggle */}
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="flex items-center justify-center gap-4 p-1 glass rounded-full border-white/10 w-fit mx-auto"
					>
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
					</motion.div>
				</motion.div>

				{/* Pricing Cards */}
				<div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
					{pricingPlans.map((plan, index) => (
						<motion.div
							key={plan.name}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
							whileHover={{ y: -8, scale: 1.02 }}
							className={`relative rounded-2xl p-8 glass-hover border transition-all duration-300 ${
								plan.popular
									? 'bg-gradient-to-b from-white/10 to-transparent border-white/20 shadow-2xl shadow-[#cbd5e1]/10'
									: 'bg-white/5 border-white/10 hover:border-white/20'
							}`}
						>
							{plan.popular && (
								<div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
									<div className="bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black text-sm font-medium px-4 py-2 rounded-full shadow-xl whitespace-nowrap">
										Most Popular
									</div>
								</div>
							)}

							<div className="text-center mb-8">
								<h3 className="text-xl font-bold text-white mb-2">
									{plan.name}
								</h3>
								<div className="flex items-baseline justify-center gap-1 mb-2 h-12">
									{plan.price ? (
										<span className="text-4xl font-bold text-white">
											{plan.price}
										</span>
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
									<li
										key={featureIndex}
										className="flex items-center gap-3 group"
									>
										<Check className="w-5 h-5 text-[#cbd5e1] flex-shrink-0 transition-transform group-hover:scale-110" />
										<span className="text-white/80 text-sm">{feature}</span>
									</li>
								))}
							</ul>

							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 shimmer-hover ${
									plan.popular
										? 'bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] text-black shadow-xl shadow-[#cbd5e1]/20 hover:shadow-2xl hover:shadow-[#cbd5e1]/30'
										: 'glass border-white/20 text-white hover:border-white/30 hover:shadow-lg'
								}`}
							>
								{plan.cta}
							</motion.button>
						</motion.div>
					))}
				</div>

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
