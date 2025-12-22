'use client'

import { JsonLd } from '@/components/json-ld'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

export function FAQSection() {
	const [openItems, setOpenItems] = useState<number[]>([])

	const toggleItem = (index: number) => {
		setOpenItems((prev) =>
			prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
		)
	}

	const faqs = [
		{
			question: 'What is Fork AI exactly?',
			answer:
				'Fork AI is a multi-AI platform with a branching chat UI. Instead of being trapped in a single messy thread, you can fork your conversations into branches, explore multiple ideas simultaneously, and share only the parts you want to share.',
		},
		{
			question: 'How does branching work?',
			answer:
				'Think of it like Git for conversations. At any point in a chat, you can create a branch to explore an alternative direction. You can have multiple branches, compare them side-by-side, and keep your main line of thought clean.',
		},
		{
			question: 'Can I switch between AI models?',
			answer:
				'Yes! Fork AI lets you switch models on any branch instantly. You can compare responses from GPT-4, Claude, Gemini, and more on the same context without re-explaining everything.',
		},
		{
			question: 'How does privacy-first sharing work?',
			answer:
				'Instead of sharing your entire conversation history, Fork AI lets you share a precise slice: a specific branch, selected messages, or an AI-generated summary. Collaborators see exactly what they need, nothing more.',
		},
		{
			question: 'Is Fork AI really free?',
			answer:
				'Yes! The free tier is ad-supported and includes unlimited branching and basic model access. Pro users get an ad-free experience, access to all AI models, and advanced features like export and priority access.',
		},
	]

	// Generate FAQ Schema for SEO
	const faqSchema = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.answer,
			},
		})),
	}

	return (
		<>
			<JsonLd data={faqSchema} />
			<section id="faq" className="relative overflow-hidden pb-120 pt-24">
			<div className="absolute top-1/2 -right-20 z-[-1] h-64 w-64 rounded-full bg-[#cbd5e1]/10 opacity-80 blur-3xl"></div>
			<div className="absolute top-1/2 -left-20 z-[-1] h-64 w-64 rounded-full bg-[#cbd5e1]/10 opacity-80 blur-3xl"></div>

			<div className="z-10 container mx-auto px-4">
				<motion.div
					className="flex justify-center"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6 }}
					viewport={{ once: true }}
				>
					<div className="glass border-white/20 text-[#cbd5e1] inline-flex items-center gap-2 rounded-full border px-3 py-1 uppercase shimmer">
						<span>✶</span>
						<span className="text-sm">Faqs</span>
					</div>
				</motion.div>

				<motion.h2
					className="mx-auto mt-6 max-w-xl text-center text-4xl font-medium md:text-[54px] md:leading-[60px]"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.2 }}
					viewport={{ once: true }}
				>
					Questions? We've got{' '}
					<span className="bg-gradient-to-b from-foreground via-gray-400 to-primary bg-clip-text text-transparent">
						answers
					</span>
				</motion.h2>

				<div className="mx-auto mt-12 flex max-w-xl flex-col gap-6">
					{faqs.map((faq, index) => (
						<motion.div
							key={index}
							/* Enhanced FAQ items with glass effect and hover animations */
							className="glass-hover rounded-2xl border border-white/10 p-6 shadow-xl cursor-pointer shimmer"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: index * 0.1 }}
							viewport={{ once: true }}
							whileHover={{
								scale: 1.02,
								borderColor: 'rgba(203, 213, 225, 0.3)',
							}}
							whileTap={{ scale: 0.98 }}
							onClick={() => toggleItem(index)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault()
									toggleItem(index)
								}
							}}
							{...(index === faqs.length - 1 && { 'data-faq': faq.question })}
						>
							<div className="flex items-start justify-between">
								<h3 className="m-0 font-medium pr-4">{faq.question}</h3>
								<motion.div
									animate={{ rotate: openItems.includes(index) ? 180 : 0 }}
									transition={{ duration: 0.3, ease: 'easeInOut' }}
									className=""
								>
									{openItems.includes(index) ? (
										/* Updated icon colors to silver */
										<Minus
											className="text-[#cbd5e1] flex-shrink-0 transition duration-300"
											size={24}
										/>
									) : (
										<Plus
											className="text-[#cbd5e1] flex-shrink-0 transition duration-300"
											size={24}
										/>
									)}
								</motion.div>
							</div>
							<AnimatePresence>
								{openItems.includes(index) && (
									<motion.div
										className="mt-4 text-muted-foreground leading-relaxed overflow-hidden"
										initial={{ opacity: 0, height: 0, marginTop: 0 }}
										animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
										exit={{ opacity: 0, height: 0, marginTop: 0 }}
										transition={{
											duration: 0.4,
											ease: 'easeInOut',
											opacity: { duration: 0.2 },
										}}
									>
										{faq.answer}
									</motion.div>
								)}
							</AnimatePresence>
						</motion.div>
					))}
				</div>
			</div>
		</section>
		</>
	)
}
