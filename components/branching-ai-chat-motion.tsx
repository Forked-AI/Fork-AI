'use client'

import {
	ArrowRight,
	Bot,
	Check,
	CheckCircle2,
	Compass,
	Eye,
	EyeOff,
	GitBranch,
	Share2,
	Sparkles,
	X,
} from 'lucide-react'
import {
	motion,
	useReducedMotion,
	useScroll,
	useTransform,
} from 'framer-motion'
import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import type {
	BranchingAiAside,
	BranchingAiSection,
} from '@/components/branching-ai-chat-content'

interface HeroProps {
	eyebrow: string
	title: string
	description: string
	highlights: string[]
	image: {
		url: string
		alt: string
	}
}

export interface SectionSpyNavItem {
	id: string
	title: string
	number: string
	label?: string
}

interface SectionSpyNavProps {
	items: SectionSpyNavItem[]
	mode: 'desktop' | 'mobile'
}

interface EditorialRevealProps {
	children: ReactNode
	className?: string
	delay?: number
	y?: number
}

interface ArticleMetaRowProps {
	author: string
	tags: string[]
	readTimeMinutes: number
}

interface ChapterRailProps {
	number: string
	label: string
}

interface PullQuoteProps {
	quote: string
	note?: string
	className?: string
}

interface FeatureBandProps {
	section: BranchingAiSection
	number: string
	label: string
	children?: ReactNode
}

interface CaseStudyBlockProps {
	step: string
	title: string
	paragraphs: string[]
	align?: 'left' | 'right'
	variant?: 'split' | 'compact'
	id?: string
	aside?: BranchingAiAside
	className?: string
}

interface PersonaStripProps {
	personas: Array<{
		title: string
		description: string
	}>
}

interface ArticleFooterCtaProps {
	eyebrow: string
	title: string
	description: string
	primaryHref: string
	primaryLabel: string
	secondaryHref: string
	secondaryLabel: string
}

function EditorialReveal({
	children,
	className,
	delay = 0,
	y = 26,
}: EditorialRevealProps) {
	const shouldReduceMotion = useReducedMotion()

	if (shouldReduceMotion) {
		return <div className={className}>{children}</div>
	}

	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.18 }}
			transition={{ duration: 0.55, delay, ease: 'easeOut' }}
		>
			{children}
		</motion.div>
	)
}

function BranchPathGraphic() {
	const nodes = [
		{
			x: 44,
			y: 38,
			r: 10,
			label: 'Prompt',
			labelX: 44,
			labelY: 72,
			anchor: 'middle' as const,
		},
		{
			x: 148,
			y: 90,
			r: 8,
			label: 'Fork',
			labelX: 148,
			labelY: 122,
			anchor: 'middle' as const,
		},
		{
			x: 78,
			y: 172,
			r: 8,
			label: 'Idea A',
			labelX: 78,
			labelY: 203,
			anchor: 'middle' as const,
		},
		{
			x: 206,
			y: 128,
			r: 8,
			label: 'Idea B',
			labelX: 206,
			labelY: 162,
			anchor: 'middle' as const,
		},
		{
			x: 282,
			y: 178,
			r: 8,
			label: 'Idea C',
			labelX: 282,
			labelY: 209,
			anchor: 'middle' as const,
		},
		{
			x: 270,
			y: 102,
			r: 7,
			label: 'Compare',
			labelX: 298,
			labelY: 96,
			anchor: 'start' as const,
		},
	]

	return (
		<svg viewBox="0 0 340 224" className="w-full" aria-hidden="true">
			<defs>
				<linearGradient id="branch-path-line" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="rgba(148,163,184,0.3)" />
					<stop offset="50%" stopColor="rgba(125,211,252,0.85)" />
					<stop offset="100%" stopColor="rgba(226,232,240,0.35)" />
				</linearGradient>
			</defs>
			<g fill="none" stroke="url(#branch-path-line)" strokeLinecap="round">
				<path d="M44 38v34" strokeWidth="3" />
				<path d="M44 72h104" strokeWidth="3" />
				<path d="M148 72v18" strokeWidth="3" />
				<path d="M148 90L78 172" strokeWidth="2.75" />
				<path d="M148 90L206 128" strokeWidth="2.75" />
				<path d="M148 90L282 178" strokeWidth="2.75" />
				<path d="M206 128L270 102" strokeWidth="2.2" opacity="0.72" />
			</g>
			{nodes.map((node) => (
				<g key={node.label}>
					<circle
						cx={node.x}
						cy={node.y}
						r={node.r}
						fill="rgba(8,15,33,0.22)"
					/>
					<circle
						cx={node.x}
						cy={node.y}
						r={node.r}
						fill="rgba(15,23,42,0.88)"
						stroke="rgba(148,163,184,0.45)"
						strokeWidth="1.5"
					/>
					<text
						x={node.labelX}
						y={node.labelY}
						textAnchor={node.anchor}
						fontSize="13"
						fontWeight="500"
						fill="rgba(226,232,240,0.82)"
						stroke="rgba(2,6,23,0.9)"
						strokeWidth="3"
						paintOrder="stroke"
					>
						{node.label}
					</text>
				</g>
			))}
		</svg>
	)
}

function ModelComparisonGraphic() {
	const models = [
		{
			name: 'ChatGPT',
			tone: 'from-emerald-400/25 to-emerald-500/5',
			height: 'h-28',
			tag: 'Iteration',
		},
		{
			name: 'Claude',
			tone: 'from-amber-300/30 to-orange-500/10',
			height: 'h-36',
			tag: 'Long-form',
			active: true,
		},
		{
			name: 'Gemini',
			tone: 'from-sky-300/25 to-blue-500/10',
			height: 'h-24',
			tag: 'Cross-check',
		},
	]

	return (
		<div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.76))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.16),transparent_32%)]" />
			<div className="relative">
				<div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
					<GitBranch className="h-3.5 w-3.5 text-sky-100/70" />
					<span>Shared branch context</span>
				</div>
				<div className="mt-6 grid gap-3 sm:grid-cols-3">
					{models.map((model) => (
						<div
							key={model.name}
							className={cn(
								'flex flex-col justify-end rounded-[1.5rem] border border-white/10 bg-gradient-to-b p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
								model.height,
								model.tone,
								model.active &&
									'border-sky-200/30 shadow-[0_0_0_1px_rgba(125,211,252,0.14)]'
							)}
						>
							<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/70">
								{model.tag}
							</p>
							<p className="mt-2 text-lg font-semibold text-white">
								{model.name}
							</p>
						</div>
					))}
				</div>
				<div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
						Validation rhythm
					</p>
					<p className="mt-3 text-sm leading-7 text-slate-200">
						One branch stays intact while each model adds a different angle to
						the same working context.
					</p>
				</div>
			</div>
		</div>
	)
}

export function AsidePanel({
	aside,
	className,
}: {
	aside: BranchingAiAside
	className?: string
}) {
	return (
		<div className={cn('border-l border-sky-200/30 pl-5 sm:pl-6', className)}>
			<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/75">
				{aside.eyebrow}
			</p>
			<h4 className="mt-3 font-[family:var(--font-serif)] text-2xl font-semibold text-white">
				{aside.title}
			</h4>
			<p className="mt-4 text-sm leading-7 text-slate-300">{aside.body}</p>
			{aside.bullets?.length ? (
				<ul className="mt-5 space-y-3">
					{aside.bullets.map((bullet) => (
						<li
							key={bullet}
							className="flex items-start gap-3 text-sm leading-7 text-slate-200"
						>
							<span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-200/80" />
							<span>{bullet}</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}

const integrationOptions: Array<{
	id: string
	name: string
	label: string
	description: string
	outputTitle: string
	output: string
	tone: string
}> = [
	{
		id: 'chatgpt',
		name: 'ChatGPT',
		label: 'Fast iteration',
		description:
			'Draft several implementation paths quickly while the branch keeps the original prompt attached.',
		outputTitle: 'Rapid branch draft',
		output:
			'Three execution paths appear fast: practical rollout, bold campaign, and validation checklist.',
		tone: 'from-emerald-300/20 to-emerald-500/5',
	},
	{
		id: 'claude',
		name: 'Claude',
		label: 'Long-form reasoning',
		description:
			'Review dense context and produce a careful critique of the same branch without rebuilding the session.',
		outputTitle: 'Careful branch critique',
		output:
			'The branch is reviewed for assumptions, missing evidence, and the tradeoffs hidden in the first answer.',
		tone: 'from-amber-300/25 to-orange-500/5',
	},
	{
		id: 'gemini',
		name: 'Gemini',
		label: 'Cross-check',
		description:
			'Compare assumptions from another model perspective before deciding which path should move forward.',
		outputTitle: 'Alternate branch check',
		output:
			'A second perspective flags edge cases and gives the team a cleaner comparison before choosing.',
		tone: 'from-sky-300/25 to-blue-500/5',
	},
]

const roleTourTabs: Array<{
	id: string
	label: string
	features: string[]
}> = [
	{
		id: 'engineers',
		label: 'Engineers',
		features: [
			'Compare architecture options without overwriting the main thread',
			'Validate tradeoffs with multiple AI models from the same context',
			'Share the chosen implementation branch with reviewers',
		],
	},
	{
		id: 'creators',
		label: 'Creators',
		features: [
			'Keep campaign angles, scripts, and drafts in separate paths',
			'Return to discarded concepts when a direction becomes useful again',
			'Package only the polished branch for client or team feedback',
		],
	},
	{
		id: 'researchers',
		label: 'Researchers',
		features: [
			'Track competing hypotheses side by side',
			'Preserve source context while testing alternate interpretations',
			'Summarize evidence for collaborators without exposing every note',
		],
	},
]

const quizOptions = [
	{
		id: 'restart',
		label: 'Restart the conversation for every new direction',
		isCorrect: false,
	},
	{
		id: 'branch',
		label: 'Branch from the same context and compare paths',
		isCorrect: true,
	},
	{
		id: 'flatten',
		label: 'Flatten every idea into one longer thread',
		isCorrect: false,
	},
]

const forkBranchMeta = [
	{
		suffix: 'practical path',
		label: 'Practical',
		x: 18,
		y: 58,
	},
	{
		suffix: 'bold path',
		label: 'Bold',
		x: 50,
		y: 73,
	},
	{
		suffix: 'validation path',
		label: 'Validate',
		x: 82,
		y: 58,
	},
]

interface ForkBranchNode {
	id: string
	label: string
	title: string
}

function BranchGraphNode({
	label,
	title,
	className,
	active = false,
}: {
	label: string
	title: string
	className?: string
	active?: boolean
}) {
	return (
		<div
			className={cn(
				'w-32 rounded-[1rem] border bg-slate-950/88 p-3 shadow-[0_14px_45px_rgba(2,6,23,0.35)] sm:w-40',
				active
					? 'border-sky-200/50 ring-2 ring-sky-200/15'
					: 'border-white/10',
				className
			)}
		>
			<p
				className={cn(
					'text-[10px] font-semibold uppercase tracking-[0.18em]',
					active ? 'text-sky-100' : 'text-slate-500'
				)}
			>
				{label}
			</p>
			<p className="mt-2 text-sm font-semibold leading-5 text-white">{title}</p>
		</div>
	)
}

function BranchingComparisonDiagram() {
	const steps = [
		{ number: '1', label: 'Prompt', x: 44, y: 102 },
		{ number: '2', label: 'Answer', x: 132, y: 102 },
		{ number: '3', label: 'Follow-up', x: 232, y: 102 },
		{ number: '4', label: 'Fork', x: 320, y: 102, active: true },
	]
	const branches = [
		{ label: 'Branch A', detail: 'Practical', x: 410, y: 48 },
		{ label: 'Branch B', detail: 'Bold', x: 410, y: 102 },
		{ label: 'Branch C', detail: 'Validation', x: 410, y: 156 },
	]

	return (
		<svg viewBox="0 0 520 220" className="h-full w-full" aria-hidden="true">
			<defs>
				<linearGradient id="tour-branch-line" x1="0%" x2="100%">
					<stop offset="0%" stopColor="rgba(148,163,184,0.35)" />
					<stop offset="56%" stopColor="rgba(125,211,252,0.9)" />
					<stop offset="100%" stopColor="rgba(226,232,240,0.45)" />
				</linearGradient>
			</defs>

			<path
				d="M44 102H320"
				stroke="rgba(148,163,184,0.35)"
				strokeWidth="4"
				strokeLinecap="round"
			/>

			{branches.map((branch) => (
				<path
					key={branch.label}
					d={`M320 102 C354 102 370 ${branch.y} ${branch.x} ${branch.y}`}
					fill="none"
					stroke="url(#tour-branch-line)"
					strokeWidth="4"
					strokeLinecap="round"
				/>
			))}

			{steps.map((step) => (
				<g key={step.label}>
					<circle
						cx={step.x}
						cy={step.y}
						r="15"
						fill={step.active ? 'rgba(125,211,252,0.16)' : 'rgba(15,23,42,0.94)'}
						stroke={step.active ? 'rgba(125,211,252,0.72)' : 'rgba(226,232,240,0.35)'}
						strokeWidth="2"
					/>
					<circle
						cx={step.x}
						cy={step.y - 28}
						r="11"
						fill="rgba(2,6,23,0.95)"
						stroke="rgba(226,232,240,0.18)"
					/>
					<text
						x={step.x}
						y={step.y - 24}
						textAnchor="middle"
						fontSize="10"
						fontWeight="700"
						fill="rgba(226,232,240,0.72)"
					>
						{step.number}
					</text>
					<text
						x={step.x}
						y={step.y + 36}
						textAnchor="middle"
						fontSize="12"
						fontWeight="600"
						fill={step.active ? 'rgba(224,242,254,0.92)' : 'rgba(226,232,240,0.82)'}
					>
						{step.label}
					</text>
				</g>
			))}

			{branches.map((branch) => (
				<g key={branch.label}>
					<circle
						cx={branch.x}
						cy={branch.y}
						r="12"
						fill="rgba(15,23,42,0.94)"
						stroke="rgba(125,211,252,0.62)"
						strokeWidth="2"
					/>
					<rect
						x={branch.x + 18}
						y={branch.y - 22}
						width="86"
						height="44"
						rx="16"
						fill="rgba(15,23,42,0.86)"
						stroke="rgba(226,232,240,0.16)"
					/>
					<text
						x={branch.x + 61}
						y={branch.y - 4}
						textAnchor="middle"
						fontSize="11"
						fontWeight="700"
						fill="rgba(224,242,254,0.9)"
					>
						{branch.label}
					</text>
					<text
						x={branch.x + 61}
						y={branch.y + 12}
						textAnchor="middle"
						fontSize="10"
						fontWeight="600"
						fill="rgba(148,163,184,0.9)"
					>
						{branch.detail}
					</text>
				</g>
			))}
		</svg>
	)
}

export function BranchingIntroComparisonWidget() {
	const [activeView, setActiveView] = useState<'old' | 'new'>('new')

	return (
		<EditorialReveal className="scroll-mt-28" y={24}>
			<section className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:p-6">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(125,211,252,0.13),transparent_32%),radial-gradient(circle_at_86%_86%,rgba(226,232,240,0.08),transparent_28%)]" />
				<div className="relative">
					<div className="flex items-center gap-3">
						<span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/30 bg-sky-200/10 text-sky-100">
							<GitBranch className="h-5 w-5" />
						</span>
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
								Workflow comparison
							</p>
							<h3 className="mt-1 font-[family:var(--font-serif)] text-2xl font-semibold leading-8 text-white">
								See why branching changes the reading experience.
							</h3>
						</div>
					</div>
					<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
						Compare the old single-thread workflow with Fork AI's branching
						workspace before diving into the article.
					</p>
					<div className="mt-6 grid gap-4 lg:grid-cols-2">
						<button
							type="button"
							aria-pressed={activeView === 'old'}
							onClick={() => setActiveView('old')}
							onMouseEnter={() => setActiveView('old')}
							className={cn(
								'rounded-[1.25rem] border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70',
								activeView === 'old'
									? 'border-rose-300/45 bg-rose-300/10 shadow-[0_0_40px_rgba(244,63,94,0.12)]'
									: 'border-white/10 bg-white/[0.035] opacity-75 hover:opacity-100'
							)}
						>
							<div className="flex items-center justify-between gap-3">
								<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
									Before: old way
								</p>
								<span className="rounded-full bg-rose-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-100">
									Context drifts
								</span>
							</div>
							<div className="mt-5 space-y-3">
								{['Prompt', 'Answer', 'Follow-up', 'Another follow-up'].map(
									(item, index) => (
										<div key={item} className="flex items-center gap-3">
											<span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950 text-xs text-slate-400">
												{index + 1}
											</span>
											<span className="h-px flex-1 bg-white/10" />
											<span className="w-28 rounded-full border border-white/10 px-3 py-1.5 text-center text-xs text-slate-300">
												{item}
											</span>
										</div>
									)
								)}
							</div>
							<p className="mt-5 text-sm leading-6 text-rose-50/80">
								Every new direction stretches the same thread, making previous
								decisions harder to scan.
							</p>
						</button>
						<button
							type="button"
							aria-pressed={activeView === 'new'}
							onClick={() => setActiveView('new')}
							onMouseEnter={() => setActiveView('new')}
							className={cn(
								'rounded-[1.25rem] border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70',
								activeView === 'new'
									? 'border-sky-200/45 bg-sky-200/[0.085] shadow-[0_0_48px_rgba(125,211,252,0.16)]'
									: 'border-sky-200/20 bg-sky-200/[0.04] opacity-75 hover:opacity-100'
							)}
						>
							<div className="flex items-center justify-between gap-3">
								<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
									After: Fork AI way
								</p>
								<span className="rounded-full bg-sky-200/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100">
									Paths stay clear
								</span>
							</div>
							<p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/70">
								Same context, separate paths
							</p>
							<div className="mt-3 h-52">
								<BranchingComparisonDiagram />
							</div>
							<p className="mt-5 text-sm leading-6 text-sky-50/85">
								The same source prompt keeps separate branches visible, so
								alternatives can be compared instead of buried.
							</p>
						</button>
					</div>
				</div>
			</section>
		</EditorialReveal>
	)
}

export function ForkGeneratorWidget() {
	const [prompt, setPrompt] = useState('Plan a launch campaign')
	const [branches, setBranches] = useState<ForkBranchNode[]>([])
	const [generationId, setGenerationId] = useState(0)

	const handleGenerate = () => {
		const basePrompt = prompt.trim() || 'Untitled idea'
		setBranches(
			forkBranchMeta.map((branch) => ({
				id: `${basePrompt}-${branch.suffix}`,
				label: branch.label,
				title: `${basePrompt}: ${branch.suffix}`,
			}))
		)
		setGenerationId((currentId) => currentId + 1)
	}

	return (
		<EditorialReveal className="scroll-mt-28" y={24}>
			<section className="rounded-[1.5rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:p-6">
				<div className="flex items-center gap-3">
					<span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/30 bg-sky-200/10 text-sky-100">
						<GitBranch className="h-5 w-5" />
					</span>
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
							Live fork generator
						</p>
						<h3 className="mt-1 font-[family:var(--font-serif)] text-2xl font-semibold leading-8 text-white">
							Generate a fork from any working idea.
						</h3>
					</div>
				</div>
				<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
					Type a prompt and watch Fork AI turn one direction into several
					focused branches.
				</p>
				<div className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4">
					<div className="flex flex-col gap-3 sm:flex-row">
						<input
							value={prompt}
							onChange={(event) => setPrompt(event.target.value)}
							className="min-h-11 flex-1 rounded-full border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-200/45"
							placeholder="Type an idea to fork"
						/>
						<button
							type="button"
							onClick={handleGenerate}
							className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-100 px-5 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70"
						>
							Generate fork
							<GitBranch className="h-4 w-4" />
						</button>
					</div>
					<div
						aria-label="Fork graph preview"
						className="relative mt-5 min-h-[32rem] overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950/72 p-4 sm:min-h-[30rem]"
					>
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(125,211,252,0.12),transparent_28%)]" />
						<svg
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
							className="pointer-events-none absolute inset-0 h-full w-full"
							aria-hidden="true"
						>
							{branches.map((branch, index) => {
								const meta = forkBranchMeta[index]

								return (
									<motion.path
										key={`${generationId}-${branch.id}-line`}
										d={`M50 26 C50 43 ${meta.x} 45 ${meta.x} ${meta.y - 7}`}
										fill="none"
										stroke="rgba(125,211,252,0.56)"
										strokeWidth="0.8"
										strokeLinecap="round"
										initial={{ pathLength: 0, opacity: 0 }}
										animate={{ pathLength: 1, opacity: 1 }}
										transition={{ duration: 0.42, delay: index * 0.12 }}
									/>
								)
							})}
						</svg>

						<motion.div
							layout
							className="absolute left-1/2 top-6 -translate-x-1/2"
						>
							<BranchGraphNode
								active
								label="Root prompt"
								title={prompt.trim() || 'Untitled idea'}
								className="w-48 sm:w-56"
							/>
						</motion.div>

						{branches.length === 0 ? (
							<div className="absolute inset-x-4 bottom-8 rounded-[1rem] border border-dashed border-white/15 bg-white/[0.025] px-4 py-5 text-center text-sm leading-6 text-slate-400">
								Click generate to spawn three child branches from this root
								prompt.
							</div>
						) : null}

						{branches.map((branch, index) => {
							const meta = forkBranchMeta[index]

							return (
								<motion.div
									key={`${generationId}-${branch.id}`}
									className="absolute"
									style={{
										left: `${meta.x}%`,
										top: `${meta.y}%`,
									}}
									initial={{ opacity: 0, scale: 0.55, x: '-50%', y: -120 }}
									animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
									transition={{
										type: 'spring',
										stiffness: 260,
										damping: 24,
										delay: 0.08 + index * 0.12,
									}}
								>
									<BranchGraphNode label={branch.label} title={branch.title} />
								</motion.div>
							)
						})}
					</div>
				</div>
			</section>
		</EditorialReveal>
	)
}

export function ModelIntegrationsWidget() {
	const [selectedId, setSelectedId] = useState(integrationOptions[0].id)
	const selected =
		integrationOptions.find((option) => option.id === selectedId) ??
		integrationOptions[0]

	return (
		<EditorialReveal className="scroll-mt-28" y={24}>
			<section className="rounded-[1.5rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:p-6">
				<div className="flex items-center gap-3">
					<span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/30 bg-sky-200/10 text-sky-100">
						<Bot className="h-5 w-5" />
					</span>
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
							Model integrations
						</p>
						<h3 className="mt-1 font-[family:var(--font-serif)] text-2xl font-semibold leading-8 text-white">
							Route one branch through multiple model perspectives.
						</h3>
					</div>
				</div>
				<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
					Select an integration to see how each model contributes a distinct
					angle without restarting context.
				</p>
				<div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.65fr)] xl:items-stretch">
					<div className="grid gap-3 md:grid-cols-3 xl:auto-rows-fr xl:grid-cols-1">
						{integrationOptions.map((option) => {
							const isSelected = option.id === selectedId

							return (
								<button
									key={option.id}
									type="button"
									aria-pressed={isSelected}
									onClick={() => setSelectedId(option.id)}
									className={cn(
										'min-h-[7rem] rounded-[1.1rem] border bg-gradient-to-br p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70 xl:min-h-0',
										option.tone,
										isSelected
											? 'scale-[1.02] border-sky-200/45 text-white shadow-[0_0_36px_rgba(125,211,252,0.12)]'
											: 'border-white/10 text-slate-400 opacity-55 hover:border-white/20 hover:opacity-85'
									)}
								>
									<div className="flex items-center justify-between gap-3">
										<p className="text-sm font-semibold">{option.name}</p>
										<span
											className={cn(
												'h-2 w-2 rounded-full',
												isSelected ? 'bg-sky-200' : 'bg-white/20'
											)}
										/>
									</div>
									<p className="mt-2 text-xs leading-5 text-slate-300">
										{option.label}
									</p>
								</button>
							)
						})}
					</div>
					<motion.div
						key={selected.id}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.22 }}
						className="flex h-full flex-col rounded-[1.25rem] border border-sky-200/25 bg-slate-950/70 p-5 shadow-[0_0_48px_rgba(125,211,252,0.08)]"
					>
						<div className="flex items-center gap-3">
							<span className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-200/25 bg-sky-200/10 text-sky-100">
								<Bot className="h-5 w-5" />
							</span>
							<div>
								<p className="text-sm font-semibold text-white">
									{selected.name}
								</p>
								<p className="text-xs text-slate-500">{selected.label}</p>
							</div>
						</div>
						<p className="mt-5 text-sm leading-7 text-slate-300">
							{selected.description}
						</p>
						<div className="mt-5 rounded-[1rem] border border-sky-200/20 bg-sky-200/[0.06] p-4 xl:mt-auto">
							<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
								Selected branch output
							</p>
							<p className="mt-2 text-sm font-semibold text-white">
								{selected.outputTitle}
							</p>
							<p className="mt-2 text-sm leading-6 text-slate-300">
								{selected.output}
							</p>
						</div>
					</motion.div>
				</div>
			</section>
		</EditorialReveal>
	)
}

export function PrivacySharingWidget() {
	const [activeView, setActiveView] = useState<'full' | 'restricted'>(
		'restricted'
	)
	const fullItems = [
		['System prompt notes', 'Private'],
		['Raw brainstorm branches', 'Private'],
		['Selected solution path', 'Shared'],
		['Decision summary', 'Shared'],
	]
	const restrictedItems = [
		['Selected solution path', 'Shared'],
		['Decision summary', 'Shared'],
		['Private notes hidden', 'Private'],
	]

	return (
		<EditorialReveal className="scroll-mt-28" y={24}>
			<section className="rounded-[1.5rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:p-6">
				<div className="flex items-center gap-3">
					<span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/30 bg-sky-200/10 text-sky-100">
						<EyeOff className="h-5 w-5" />
					</span>
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
							Privacy and sharing
						</p>
						<h3 className="mt-1 font-[family:var(--font-serif)] text-2xl font-semibold leading-8 text-white">
							Share only the context collaborators need.
						</h3>
					</div>
				</div>
				<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
					Preview the difference between a full workspace and a restricted
					shared branch.
				</p>
				<div className="mt-5 inline-flex rounded-full border border-white/10 bg-slate-950/70 p-1">
					{[
						{ id: 'full', label: 'Before: full view' },
						{ id: 'restricted', label: 'After: restricted share' },
					].map((view) => (
						<button
							key={view.id}
							type="button"
							aria-pressed={activeView === view.id}
							onClick={() => setActiveView(view.id as 'full' | 'restricted')}
							className={cn(
								'rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70',
								activeView === view.id
									? 'bg-sky-200 text-slate-950'
									: 'text-slate-400 hover:text-white'
							)}
						>
							{view.label}
						</button>
					))}
				</div>
				<div className="mt-6 grid gap-4 lg:grid-cols-2">
					{[
						{ id: 'full', title: 'Full view', icon: Eye, items: fullItems },
						{
							id: 'restricted',
							title: 'Restricted view',
							icon: EyeOff,
							items: restrictedItems,
						},
					].map((column) => {
						const Icon = column.icon
						const isActive = activeView === column.id

						return (
							<div
								key={column.title}
								className={cn(
									'rounded-[1.25rem] border p-4 transition-all',
									isActive
										? 'border-sky-200/40 bg-sky-200/[0.06] shadow-[0_0_42px_rgba(125,211,252,0.1)]'
										: 'border-white/10 bg-white/[0.025] opacity-55'
								)}
							>
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-3">
										<Icon className="h-4 w-4 text-sky-100/70" />
										<p className="text-sm font-semibold text-white">
											{column.title}
										</p>
									</div>
									<p className="text-sm font-semibold text-white">
										{isActive ? 'Highlighted' : 'Muted'}
									</p>
								</div>
								<div className="mt-4 space-y-3">
									{column.items.map(([label, state]) => {
										const isShared = state === 'Shared'
										const shouldHighlight =
											(activeView === 'full' && !isShared) ||
											(activeView === 'restricted' && isShared)

										return (
											<div
												key={`${column.title}-${label}`}
												className={cn(
													'flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors',
													shouldHighlight
														? isShared
															? 'border-sky-200/35 bg-sky-200/10'
															: 'border-rose-300/35 bg-rose-300/10'
														: 'border-white/10 bg-slate-950/62'
												)}
											>
												<span className="text-sm text-slate-300">
													{label}
												</span>
												<span
													className={cn(
														'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
														isShared
															? 'bg-sky-200/14 text-sky-100'
															: 'bg-white/8 text-slate-400'
													)}
												>
													{state}
												</span>
											</div>
										)
									})}
								</div>
							</div>
						)
					})}
				</div>
			</section>
		</EditorialReveal>
	)
}

export function AudienceRolesWidget() {
	const [activeRoleId, setActiveRoleId] = useState(roleTourTabs[0].id)
	const activeRole =
		roleTourTabs.find((role) => role.id === activeRoleId) ?? roleTourTabs[0]

	return (
		<EditorialReveal className="scroll-mt-28" y={24}>
			<section className="rounded-[1.5rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:p-6">
				<div className="flex items-center gap-3">
					<span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/30 bg-sky-200/10 text-sky-100">
						<Share2 className="h-5 w-5" />
					</span>
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
							Who it's for
						</p>
						<h3 className="mt-1 font-[family:var(--font-serif)] text-2xl font-semibold leading-8 text-white">
							Match branching workflows to different roles.
						</h3>
					</div>
				</div>
				<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
					Switch roles to see how engineers, creators, and researchers use
					Fork AI differently.
				</p>
				<div className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4">
					<div className="flex flex-wrap gap-2">
						{roleTourTabs.map((role) => (
							<button
								key={role.id}
								type="button"
								aria-pressed={role.id === activeRoleId}
								onClick={() => setActiveRoleId(role.id)}
								className={cn(
									'rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70',
									role.id === activeRoleId
										? 'border-sky-200/45 bg-sky-200/12 text-white'
										: 'border-white/10 bg-slate-950/50 text-slate-400 hover:text-white'
								)}
							>
								{role.label}
							</button>
						))}
					</div>
					<motion.div
						key={`${activeRole.id}-summary`}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
						className="mt-5 rounded-[1rem] border border-sky-200/25 bg-sky-200/[0.06] px-4 py-3"
					>
						<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
							Highlighted workflow
						</p>
						<p className="mt-2 text-sm font-semibold text-white">
							{activeRole.label} get a tailored branch map instead of a generic
							chat thread.
						</p>
					</motion.div>
					<motion.ul
						key={activeRole.id}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
						className="mt-5 grid gap-3"
					>
						{activeRole.features.map((feature, index) => (
							<li
								key={feature}
								className="flex items-start gap-3 rounded-xl border border-sky-200/20 bg-sky-200/[0.055] px-4 py-3 text-sm leading-6 text-slate-100 shadow-[0_0_24px_rgba(125,211,252,0.06)]"
							>
								<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-200 text-[10px] font-bold text-slate-950">
									{index + 1}
								</span>
								<span>{feature}</span>
							</li>
						))}
					</motion.ul>
				</div>
			</section>
		</EditorialReveal>
	)
}

export function BranchingQuizWidget() {
	const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
	const selectedOption = quizOptions.find(
		(option) => option.id === selectedOptionId
	)

	return (
		<EditorialReveal className="scroll-mt-28" y={24}>
			<section className="rounded-[1.5rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:p-6">
				<div className="flex items-center gap-3">
					<span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/30 bg-sky-200/10 text-sky-100">
						<CheckCircle2 className="h-5 w-5" />
					</span>
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
							Quick check
						</p>
						<h3 className="mt-1 font-[family:var(--font-serif)] text-2xl font-semibold leading-8 text-white">
							Check the core idea before continuing.
						</h3>
					</div>
				</div>
				<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
					Answer one question to reinforce what makes branching AI chat
					different from a standard thread.
				</p>
				<div className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4">
					<p className="text-sm font-semibold leading-6 text-white">
						What is the main advantage of Fork AI over a standard linear AI
						chat?
					</p>
					<div className="mt-4 grid gap-3">
						{quizOptions.map((option) => {
							const isSelected = option.id === selectedOptionId
							const shouldShowResult = Boolean(selectedOptionId)
							const resultIcon = option.isCorrect ? Check : X
							const ResultIcon = resultIcon

							return (
								<button
									key={option.id}
									type="button"
									onClick={() => setSelectedOptionId(option.id)}
									className={cn(
										'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70',
										shouldShowResult && option.isCorrect
											? 'border-emerald-300/45 bg-emerald-300/10 text-emerald-50'
											: shouldShowResult && isSelected
												? 'border-rose-300/45 bg-rose-300/10 text-rose-50'
												: 'border-white/10 bg-slate-950/62 text-slate-300 hover:border-white/20'
									)}
								>
									<span>{option.label}</span>
									{shouldShowResult && (option.isCorrect || isSelected) ? (
										<ResultIcon className="h-4 w-4 shrink-0" />
									) : null}
								</button>
							)
						})}
					</div>
					{selectedOption ? (
						<motion.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2 }}
							className={cn(
								'mt-4 rounded-xl border px-4 py-3 text-sm leading-6',
								selectedOption.isCorrect
									? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-50'
									: 'border-rose-300/30 bg-rose-300/10 text-rose-50'
							)}
						>
							<p>
								{selectedOption.isCorrect
									? 'Correct. Fork AI keeps the source context intact while each branch explores a different path.'
									: 'Not quite. The key is preserving one source context while branching into multiple focused paths.'}
							</p>
							<div className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-slate-100">
								<span className="font-semibold">Why this matters: </span>
								branching keeps alternatives visible long enough to compare,
								validate, and share the right slice.
							</div>
						</motion.div>
					) : null}
				</div>
			</section>
		</EditorialReveal>
	)
}

export function BranchingAiHero({
	eyebrow,
	title,
	description,
	highlights,
	image,
}: HeroProps) {
	const shouldReduceMotion = useReducedMotion()
	const figureRef = useRef<HTMLElement | null>(null)
	const { scrollYProgress } = useScroll({
		target: figureRef,
		offset: ['start end', 'end start'],
	})
	const imageY = useTransform(scrollYProgress, [0, 1], [18, -18])

	return (
		<section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/45 px-6 py-8 shadow-[0_24px_120px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:px-8 sm:py-10 lg:px-12 lg:py-14">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.18),transparent_28%)]" />
			<div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center xl:grid-cols-[minmax(0,1fr)_30rem]">
				<motion.div
					initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{
						duration: shouldReduceMotion ? 0 : 0.55,
						ease: 'easeOut',
					}}
					className="max-w-3xl"
				>
					<div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100/90">
						<Sparkles className="h-3.5 w-3.5" />
						<span>{eyebrow}</span>
					</div>
					<h1 className="mt-6 font-[family:var(--font-serif)] text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
						{title}
					</h1>
					<p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
						{description}
					</p>
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Link
							href="/signup"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-slate-100 to-slate-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5"
						>
							Start free
							<ArrowRight className="h-4 w-4" />
						</Link>
						<Link
							href="/landing#pricing"
							className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-white/25 hover:bg-white/10"
						>
							View pricing
							<Compass className="h-4 w-4" />
						</Link>
					</div>
					<ul className="mt-8 flex flex-wrap gap-3">
						{highlights.map((highlight, index) => (
							<motion.li
								key={highlight}
								initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{
									duration: shouldReduceMotion ? 0 : 0.45,
									delay: shouldReduceMotion ? 0 : 0.12 + index * 0.08,
									ease: 'easeOut',
								}}
								className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
							>
								{highlight}
							</motion.li>
						))}
					</ul>
				</motion.div>

				<motion.figure
					ref={figureRef}
					initial={
						shouldReduceMotion ? false : { opacity: 0, scale: 0.97, y: 28 }
					}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					transition={{
						duration: shouldReduceMotion ? 0 : 0.65,
						ease: 'easeOut',
					}}
					style={shouldReduceMotion ? undefined : { y: imageY }}
					className="relative"
				>
					<div className="absolute -inset-5 rounded-[2rem] bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_62%)] blur-3xl" />
					<div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-2xl">
						<div className="relative aspect-[4/5]">
							<Image
								src={image.url}
								alt={image.alt}
								fill
								priority
								sizes="(min-width: 1280px) 480px, (min-width: 1024px) 400px, 100vw"
								className="object-cover"
							/>
						</div>
						<div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-slate-950/75 p-4 backdrop-blur-md">
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/75">
								Fork AI workflow
							</p>
							<p className="mt-2 text-sm leading-6 text-slate-200">
								Compare branches, keep alternate ideas intact, and validate the
								same context across multiple AI models.
							</p>
						</div>
					</div>
					<figcaption className="mt-4 text-sm text-slate-400">
						<em>
							Header Image: Photo by{' '}
							<a
								href="https://unsplash.com/@solenfeyissa?utm_source=neotype&utm_medium=referral"
								target="_blank"
								rel="noreferrer noopener"
								className="text-slate-200 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
							>
								Solen Feyissa
							</a>{' '}
							/{' '}
							<a
								href="https://unsplash.com/?utm_source=neotype&utm_medium=referral"
								target="_blank"
								rel="noreferrer noopener"
								className="text-slate-200 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
							>
								Unsplash
							</a>
						</em>
					</figcaption>
				</motion.figure>
			</div>
		</section>
	)
}

export function ArticleMetaRow({
	author,
	tags,
	readTimeMinutes,
}: ArticleMetaRowProps) {
	return (
		<EditorialReveal className="mt-6">
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300">
					<span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
						{author}
					</span>
					<span className="hidden text-slate-500 sm:inline">•</span>
					<span className="text-slate-400">{readTimeMinutes} min read</span>
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{tags.map((tag) => (
						<span
							key={tag}
							className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300"
						>
							{tag}
						</span>
					))}
				</div>
			</div>
		</EditorialReveal>
	)
}

export function ChapterRail({ number, label }: ChapterRailProps) {
	return (
		<div className="hidden lg:block">
			<div className="sticky top-32">
				<p className="font-[family:var(--font-serif)] text-6xl leading-none text-white/14">
					{number}
				</p>
				<div className="mt-4 h-14 w-px bg-gradient-to-b from-sky-200/80 to-transparent" />
				<p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
					{label}
				</p>
			</div>
		</div>
	)
}

export function PullQuote({ quote, note, className }: PullQuoteProps) {
	return (
		<EditorialReveal
			className={cn('border-l border-sky-200/40 pl-5 sm:pl-6', className)}
			delay={0.08}
			y={18}
		>
			<blockquote className="font-[family:var(--font-serif)] text-xl font-medium leading-8 text-slate-100 sm:text-[1.45rem] sm:leading-9">
				<span className="text-sky-100/70">“</span>
				{quote}
				<span className="text-sky-100/70">”</span>
			</blockquote>
			{note ? (
				<p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">{note}</p>
			) : null}
		</EditorialReveal>
	)
}

export function SectionSpyNav({ items, mode }: SectionSpyNavProps) {
	const [activeId, setActiveId] = useState(items[0]?.id ?? '')
	const shouldReduceMotion = useReducedMotion()

	useEffect(() => {
		let animationFrameId: number | null = null

		const getSections = () =>
			items
				.map((item) => document.getElementById(item.id))
				.filter((value): value is HTMLElement => Boolean(value))

		const getHashId = () =>
			decodeURIComponent(window.location.hash.replace(/^#/, ''))

		const getTopOffset = () => (window.innerWidth >= 1280 ? 112 : 144)

		const setActiveSection = (id: string) => {
			setActiveId((currentId) => (currentId === id ? currentId : id))
		}

		const updateActiveSection = () => {
			animationFrameId = null

			const sections = getSections()

			if (sections.length === 0) {
				return
			}

			const scrollBottom = window.scrollY + window.innerHeight
			const pageBottom = Math.max(
				document.body.scrollHeight,
				document.documentElement.scrollHeight
			)

			if (pageBottom - scrollBottom <= 8) {
				setActiveSection(sections[sections.length - 1].id)
				return
			}

			const activationLine =
				window.scrollY + getTopOffset() + Math.min(window.innerHeight * 0.18, 180)
			let nextActiveId = sections[0].id

			for (const section of sections) {
				const sectionTop =
					section.getBoundingClientRect().top + window.scrollY

				if (sectionTop <= activationLine) {
					nextActiveId = section.id
				} else {
					break
				}
			}

			setActiveSection(nextActiveId)
		}

		const scheduleActiveSectionUpdate = () => {
			if (animationFrameId !== null) {
				return
			}

			animationFrameId = window.requestAnimationFrame(updateActiveSection)
		}

		const syncActiveSectionFromHash = () => {
			const hashId = getHashId()

			if (hashId && items.some((item) => item.id === hashId)) {
				setActiveSection(hashId)
				return true
			}

			return false
		}

		const handleHashChange = () => {
			if (!syncActiveSectionFromHash()) {
				scheduleActiveSectionUpdate()
			}
		}

		if (!syncActiveSectionFromHash()) {
			scheduleActiveSectionUpdate()
		}
		window.addEventListener('scroll', scheduleActiveSectionUpdate, {
			passive: true,
		})
		window.addEventListener('resize', scheduleActiveSectionUpdate)
		window.addEventListener('hashchange', handleHashChange)

		return () => {
			if (animationFrameId !== null) {
				window.cancelAnimationFrame(animationFrameId)
			}

			window.removeEventListener('scroll', scheduleActiveSectionUpdate)
			window.removeEventListener('resize', scheduleActiveSectionUpdate)
			window.removeEventListener('hashchange', handleHashChange)
		}
	}, [items])

	const handleNavigate = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return
		}

		const target = document.getElementById(id)

		if (!target) {
			return
		}

		event.preventDefault()
		setActiveId(id)

		const topOffset = window.innerWidth >= 1280 ? 112 : 144
		const nextTop =
			target.getBoundingClientRect().top + window.scrollY - topOffset

		window.history.pushState(null, '', `#${id}`)
		window.scrollTo({
			top: nextTop,
			behavior: shouldReduceMotion ? 'auto' : 'smooth',
		})
	}

	if (mode === 'mobile') {
		return (
			<nav
				aria-label="Jump to article sections"
				className="sticky top-20 z-30 -mx-4 mt-10 border-y border-white/10 bg-slate-950/72 px-4 py-3 backdrop-blur-xl xl:hidden"
			>
				<div className="flex gap-3 overflow-x-auto pb-1">
					{items.map((item) => {
						const isActive = item.id === activeId

						return (
							<a
								key={item.id}
								href={`#${item.id}`}
								onClick={(event) => handleNavigate(event, item.id)}
								className={cn(
									'relative min-w-fit shrink-0 overflow-hidden rounded-full px-4 py-2.5 text-left transition-colors',
									isActive ? 'text-white' : 'text-slate-400 hover:text-white'
								)}
							>
								{isActive ? (
									<motion.span
										layoutId="section-nav-pill"
										className="absolute inset-0 rounded-full border border-sky-200/25 bg-white/[0.06]"
										transition={{ duration: 0.22, ease: 'easeOut' }}
									/>
								) : null}
								<span className="relative block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
									{item.number}
								</span>
								<span className="relative mt-1 block text-sm">
									{item.title}
								</span>
							</a>
						)
					})}
				</div>
			</nav>
		)
	}

	return (
		<nav
			aria-label="Table of contents"
			className="hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 xl:block"
		>
			<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
				Guide
			</p>
			<div className="relative mt-6">
				<div className="absolute bottom-4 left-[0.625rem] top-4 w-px bg-gradient-to-b from-white/10 via-white/10 to-transparent" />
				{items.map((item) => {
					const isActive = item.id === activeId

					return (
						<a
							key={item.id}
							href={`#${item.id}`}
							onClick={(event) => handleNavigate(event, item.id)}
							className={cn(
								'group relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-5 py-4 transition-colors',
								isActive ? 'text-white' : 'text-slate-400 hover:text-white'
							)}
						>
							<span className="relative flex justify-center pt-1.5">
								<motion.span
									className={cn(
										'block h-3 w-3 rounded-full border shadow-[0_0_0_4px_rgba(2,6,23,0.95)] transition-colors',
										isActive
											? 'border-sky-200/80 bg-sky-200/80'
											: 'border-white/20 bg-slate-950'
									)}
									animate={
										shouldReduceMotion
											? undefined
											: {
													scale: isActive ? 1.18 : 1,
													opacity: isActive ? 1 : 0.9,
												}
									}
									transition={{ duration: 0.22, ease: 'easeOut' }}
								/>
							</span>
							<span className="block">
								<span
									className={cn(
										'block text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors',
										isActive ? 'text-sky-100/80' : 'text-slate-500'
									)}
								>
									{item.number}
								</span>
								<span className="mt-1 block text-sm leading-6">
									{item.title}
								</span>
							</span>
						</a>
					)
				})}
			</div>
		</nav>
	)
}

export function FeatureBand({
	section,
	number,
	label,
	children,
}: FeatureBandProps) {
	const subsection = section.subsections[0]
	const [leadParagraph, ...continuationParagraphs] = subsection.paragraphs

	return (
		<EditorialReveal className="scroll-mt-28" y={34}>
			<section
				id={section.id}
				className="grid gap-10 border-t border-white/10 pt-16 sm:pt-20 lg:grid-cols-[8.5rem_minmax(0,1fr)] xl:gap-12"
			>
				<ChapterRail number={number} label={label} />
				<div>
					<div className="lg:hidden">
						<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
							{number} {label}
						</p>
					</div>
					<h2 className="mt-4 max-w-3xl font-[family:var(--font-serif)] text-3xl font-semibold text-white sm:text-4xl">
						{section.title}
					</h2>

					<div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-start">
						<div id={subsection.id} className="scroll-mt-28 max-w-4xl">
							<h3 className="font-[family:var(--font-serif)] text-2xl font-semibold text-white">
								{subsection.title}
							</h3>
							<div className="mt-6 space-y-5 text-base leading-8 text-slate-300">
								<p>{leadParagraph}</p>
							</div>
						</div>

						<div className="space-y-6 xl:pl-4">
							{section.aside ? <AsidePanel aside={section.aside} /> : null}

							<ModelComparisonGraphic />
						</div>
					</div>

					{continuationParagraphs.length ? (
						<div className="mt-10 max-w-5xl border-t border-white/10 pt-8">
							<div className="space-y-5 text-base leading-8 text-slate-300 lg:max-w-4xl">
								{continuationParagraphs.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</div>
						</div>
					) : null}

					{section.highlightCards?.length ? (
						<div className="mt-12 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2 xl:grid-cols-3">
							{section.highlightCards.map((card, index) => (
								<EditorialReveal
									key={card.title}
									delay={0.08 + index * 0.05}
									className="border-l border-sky-200/25 pl-5"
									y={18}
								>
									<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100/75">
										{card.title}
									</p>
									<p className="mt-3 text-sm leading-7 text-slate-200">
										{card.description}
									</p>
								</EditorialReveal>
							))}
						</div>
					) : null}

					{children ? <div className="mt-12">{children}</div> : null}
				</div>
			</section>
		</EditorialReveal>
	)
}

export function CaseStudyBlock({
	step,
	title,
	paragraphs,
	align = 'left',
	variant = 'split',
	id,
	aside,
	className,
}: CaseStudyBlockProps) {
	if (variant === 'compact') {
		return (
			<EditorialReveal
				className={cn('border-l border-white/10 pl-5 sm:pl-6', className)}
				y={20}
			>
				<div id={id} className={id ? 'scroll-mt-28' : undefined}>
					<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
						{step}
					</p>
					<p className="mt-3 font-[family:var(--font-serif)] text-2xl font-semibold text-white">
						{title}
					</p>
					<div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
						{paragraphs.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
					</div>
				</div>
			</EditorialReveal>
		)
	}

	return (
		<EditorialReveal className={cn('scroll-mt-28', className)} y={24}>
			<div
				id={id}
				className="grid gap-8 border-t border-white/10 pt-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12"
			>
				<div className={align === 'right' ? 'lg:order-2' : ''}>
					<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
						{step}
					</p>
					<h3 className="mt-3 font-[family:var(--font-serif)] text-2xl font-semibold text-white">
						{title}
					</h3>
					<div className="mt-4 space-y-4 text-base leading-8 text-slate-300">
						{paragraphs.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
					</div>
				</div>

				{aside ? (
					<div className={align === 'right' ? 'lg:order-1' : ''}>
						<AsidePanel aside={aside} />
					</div>
				) : null}
			</div>
		</EditorialReveal>
	)
}

export function PersonaStrip({ personas }: PersonaStripProps) {
	return (
		<EditorialReveal className="mt-12 border-y border-white/10 py-8" y={18}>
			<div className="grid gap-8 md:grid-cols-3">
				{personas.map((persona, index) => (
					<div
						key={persona.title}
						className={cn(
							'md:px-6',
							index > 0 && 'md:border-l md:border-white/10'
						)}
					>
						<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
							{persona.title}
						</p>
						<p className="mt-3 text-sm leading-7 text-slate-200">
							{persona.description}
						</p>
					</div>
				))}
			</div>
		</EditorialReveal>
	)
}

export function ArticleFooterCta({
	eyebrow,
	title,
	description,
	primaryHref,
	primaryLabel,
	secondaryHref,
	secondaryLabel,
}: ArticleFooterCtaProps) {
	return (
		<EditorialReveal
			className="mt-10 rounded-[2.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(125,211,252,0.08),rgba(15,23,42,0.75))] p-8 shadow-[0_24px_100px_rgba(15,23,42,0.45)] sm:p-10"
			y={26}
		>
			<div className="max-w-3xl">
				<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
					{eyebrow}
				</p>
				<p className="mt-4 font-[family:var(--font-serif)] text-3xl font-semibold text-white sm:text-[2.6rem] sm:leading-[3.1rem]">
					{title}
				</p>
				<p className="mt-4 text-base leading-8 text-slate-300">{description}</p>
				<div className="mt-8 flex flex-col gap-3 sm:flex-row">
					<Link
						href={primaryHref}
						className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-slate-100 to-slate-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5"
					>
						{primaryLabel}
					</Link>
					<Link
						href={secondaryHref}
						className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-white/25 hover:bg-white/10"
					>
						{secondaryLabel}
					</Link>
				</div>
			</div>
		</EditorialReveal>
	)
}

export function SplitChapterAside({ aside }: { aside: BranchingAiAside }) {
	return (
		<EditorialReveal delay={0.08}>
			<figure className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.76))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
				<BranchPathGraphic />
				<figcaption className="mt-5 border-t border-white/10 pt-4">
					<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
						{aside.eyebrow}
					</p>
					<p className="mt-3 font-[family:var(--font-serif)] text-2xl font-semibold text-white">
						{aside.title}
					</p>
				</figcaption>
			</figure>
		</EditorialReveal>
	)
}
