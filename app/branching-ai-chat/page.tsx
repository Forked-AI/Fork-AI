import {
	AsidePanel,
	ArticleFooterCta,
	ArticleMetaRow,
	AudienceRolesWidget,
	BranchingAiHero,
	BranchingIntroComparisonWidget,
	BranchingQuizWidget,
	CaseStudyBlock,
	ChapterRail,
	FeatureBand,
	ForkGeneratorWidget,
	ModelIntegrationsWidget,
	PersonaStrip,
	PrivacySharingWidget,
	PullQuote,
	SectionSpyNav,
	SplitChapterAside,
	type SectionSpyNavItem,
} from '@/components/branching-ai-chat-motion'
import {
	branchingAiChatArticleMeta,
	branchingAiChatDescription,
	branchingAiChatFooterCta,
	branchingAiChatHero,
	branchingAiChatImage,
	branchingAiChatKeywords,
	branchingAiChatPersonas,
	branchingAiChatSections,
	branchingAiChatTitle,
	createBranchingAiArticleSchema,
} from '@/components/branching-ai-chat-content'
import { JsonLd } from '@/components/json-ld'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { SITE_URL } from '@/lib/site-config'
import type { Metadata } from 'next'

const pagePath = '/branching-ai-chat'

export const metadata: Metadata = {
	title: branchingAiChatTitle,
	description: branchingAiChatDescription,
	keywords: branchingAiChatKeywords,
	alternates: {
		canonical: pagePath,
	},
	openGraph: {
		type: 'article',
		url: pagePath,
		title: branchingAiChatTitle,
		description: branchingAiChatDescription,
		images: [
			{
				url: branchingAiChatImage.url,
				alt: branchingAiChatImage.alt,
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: branchingAiChatTitle,
		description: branchingAiChatDescription,
		images: [branchingAiChatImage.url],
	},
}

const sectionNavItems: SectionSpyNavItem[] = branchingAiChatSections.map(
	(section, index) => ({
		id: section.id,
		title: section.title,
		number: String(index + 1).padStart(2, '0'),
		label: section.chapterLabel,
	})
)

const [
	chapterOne,
	chapterTwo,
	chapterThree,
	chapterFour,
	chapterFive,
	conclusionSection,
] = branchingAiChatSections

const summaryAside = {
	eyebrow: 'Shared summaries',
	title: 'Clarity improves when the recap is part of the workflow.',
	body: 'ForkAI condenses long collaborative sessions into concise summaries that keep the team aligned on the decisions and context that actually matter.',
	bullets: [
		'Highlight decisions without replaying the entire conversation',
		'Reduce misinterpretation across longer working sessions',
		'Give collaborators a clear view of next steps and rationale',
	],
}

function ParagraphGroup({
	paragraphs,
	className = '',
}: {
	paragraphs: string[]
	className?: string
}) {
	return (
		<div
			className={`space-y-4 text-base leading-8 text-slate-300 ${className}`}
		>
			{paragraphs.map((paragraph) => (
				<p key={paragraph}>{paragraph}</p>
			))}
		</div>
	)
}

export default function BranchingAiChatPage() {
	const articleSchema = createBranchingAiArticleSchema(SITE_URL)

	const introLeadParagraph = chapterOne.subsections[0].paragraphs[0]
	const introContinuationParagraphs =
		chapterOne.subsections[0].paragraphs.slice(1)
	const firstChapterParagraphs =
		introContinuationParagraphs.length > 0
			? introContinuationParagraphs
			: chapterOne.subsections[0].paragraphs
	const [chapterTwoLeadParagraph, ...chapterTwoContinuationParagraphs] =
		chapterTwo.subsections[0].paragraphs
	const laterChapterLayoutClass =
		'scroll-mt-28 grid gap-10 border-t border-white/10 pt-16 sm:pt-20 lg:grid-cols-[8.5rem_minmax(0,1fr)] xl:gap-12'

	return (
		<AuroraBackground className="min-h-screen w-full overflow-visible">
			<JsonLd data={articleSchema} />

			<div className="relative pb-36 pt-28 sm:pt-32">
				<div className="pointer-events-none absolute inset-0">
					<div className="absolute left-[6%] top-24 h-56 w-56 rounded-full bg-sky-400/10 blur-[120px]" />
					<div className="absolute right-[6%] top-[28rem] h-72 w-72 rounded-full bg-slate-300/10 blur-[150px]" />
				</div>

				<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<BranchingAiHero
						eyebrow={branchingAiChatHero.eyebrow}
						title={branchingAiChatTitle}
						description={branchingAiChatHero.description}
						highlights={branchingAiChatHero.highlights}
						image={branchingAiChatImage}
					/>

					<ArticleMetaRow
						author={branchingAiChatArticleMeta.author}
						tags={branchingAiChatArticleMeta.topicTags}
						readTimeMinutes={branchingAiChatArticleMeta.readTimeMinutes}
						publishedAt={branchingAiChatArticleMeta.publishedAt}
						modifiedAt={branchingAiChatArticleMeta.modifiedAt}
					/>

					<SectionSpyNav items={sectionNavItems} mode="mobile" />

					<div className="mt-12 xl:grid xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-16">
						<article className="space-y-24 sm:space-y-28">
							<section
								id={chapterOne.id}
								className="scroll-mt-28 grid gap-10 lg:grid-cols-[11rem_minmax(0,1fr)] xl:gap-16"
							>
								<ChapterRail
									number={sectionNavItems[0].number}
									label={chapterOne.chapterLabel}
								/>
								<div>
									<div className="lg:hidden">
										<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
											{sectionNavItems[0].number} {chapterOne.chapterLabel}
										</p>
									</div>
									<h2 className="mt-4 max-w-3xl font-[family:var(--font-serif)] text-3xl font-semibold text-white sm:text-4xl">
										{chapterOne.title}
									</h2>

									<div className="mt-12 space-y-12">
										<div
											id={chapterOne.subsections[0].id}
											className="scroll-mt-28"
										>
											<h3 className="font-[family:var(--font-serif)] text-2xl font-semibold text-white">
												{chapterOne.subsections[0].title}
											</h3>
											<ParagraphGroup
												paragraphs={[introLeadParagraph]}
												className="mt-5 max-w-3xl"
											/>
											{chapterOne.pullQuote ? (
												<PullQuote
													quote={chapterOne.pullQuote.quote}
													note={chapterOne.pullQuote.note}
													className="mt-6 max-w-2xl"
												/>
											) : null}
											<ParagraphGroup
												paragraphs={firstChapterParagraphs}
												className="mt-6 max-w-3xl"
											/>
										</div>

										<BranchingIntroComparisonWidget />

										{chapterOne.subsections.slice(1).map((subsection) => (
											<div
												key={subsection.id}
												id={subsection.id}
												className="scroll-mt-28 border-t border-white/10 pt-12"
											>
												<h3 className="font-[family:var(--font-serif)] text-2xl font-semibold text-white">
													{subsection.title}
												</h3>
												<ParagraphGroup
													paragraphs={subsection.paragraphs}
													className="mt-5 max-w-3xl"
												/>
											</div>
										))}
									</div>
								</div>
							</section>

							<section id={chapterTwo.id} className={laterChapterLayoutClass}>
								<ChapterRail
									number={sectionNavItems[1].number}
									label={chapterTwo.chapterLabel}
								/>
								<div>
									<div className="lg:hidden">
										<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
											{sectionNavItems[1].number} {chapterTwo.chapterLabel}
										</p>
									</div>
									<h2 className="mt-4 max-w-3xl font-[family:var(--font-serif)] text-3xl font-semibold text-white sm:text-4xl">
										{chapterTwo.title}
									</h2>

									<div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-start">
										<div
											id={chapterTwo.subsections[0].id}
											className="scroll-mt-28 max-w-4xl"
										>
											<h3 className="font-[family:var(--font-serif)] text-2xl font-semibold text-white">
												{chapterTwo.subsections[0].title}
											</h3>
											<ParagraphGroup
												paragraphs={[chapterTwoLeadParagraph]}
												className="mt-6 max-w-3xl"
											/>
										</div>

										{chapterTwo.aside ? (
											<SplitChapterAside aside={chapterTwo.aside} />
										) : null}
									</div>

									<div className="mt-10 grid gap-10 border-t border-white/10 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:gap-12">
										<ParagraphGroup
											paragraphs={chapterTwoContinuationParagraphs}
											className="max-w-4xl"
										/>

										{chapterTwo.aside ? (
											<AsidePanel aside={chapterTwo.aside} />
										) : null}
									</div>

									<div className="mt-12">
										<ForkGeneratorWidget />
									</div>
								</div>
							</section>

							<FeatureBand
								section={chapterThree}
								number={sectionNavItems[2].number}
								label={chapterThree.chapterLabel}
							>
								<ModelIntegrationsWidget />
							</FeatureBand>

							<section id={chapterFour.id} className={laterChapterLayoutClass}>
								<ChapterRail
									number={sectionNavItems[3].number}
									label={chapterFour.chapterLabel}
								/>
								<div>
									<div className="lg:hidden">
										<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
											{sectionNavItems[3].number} {chapterFour.chapterLabel}
										</p>
									</div>
									<h2 className="mt-4 max-w-3xl font-[family:var(--font-serif)] text-3xl font-semibold text-white sm:text-4xl">
										{chapterFour.title}
									</h2>

									<div className="mt-12 space-y-12">
										<CaseStudyBlock
											id={chapterFour.subsections[0].id}
											step="01"
											title={chapterFour.subsections[0].title}
											paragraphs={chapterFour.subsections[0].paragraphs}
											aside={chapterFour.aside}
										/>

										<PrivacySharingWidget />

										<CaseStudyBlock
											id={chapterFour.subsections[1].id}
											step="02"
											title={chapterFour.subsections[1].title}
											paragraphs={chapterFour.subsections[1].paragraphs}
											align="right"
											aside={summaryAside}
										/>

										<div
											id={chapterFour.subsections[2].id}
											className="scroll-mt-28 border-t border-white/10 pt-12"
										>
											<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
												03 Case studies
											</p>
											<h3 className="mt-3 font-[family:var(--font-serif)] text-2xl font-semibold text-white">
												{chapterFour.subsections[2].title}
											</h3>
											<div className="mt-8 grid gap-8 md:grid-cols-2">
												<CaseStudyBlock
													step="Engineering teams"
													title="Advanced engineering programs"
													paragraphs={[
														chapterFour.subsections[2].paragraphs[0],
													]}
													variant="compact"
												/>
												<CaseStudyBlock
													step="Academic research"
													title="Collaborative academic studies"
													paragraphs={[
														chapterFour.subsections[2].paragraphs[1],
													]}
													variant="compact"
												/>
											</div>
										</div>
									</div>
								</div>
							</section>

							<section id={chapterFive.id} className={laterChapterLayoutClass}>
								<ChapterRail
									number={sectionNavItems[4].number}
									label={chapterFive.chapterLabel}
								/>
								<div>
									<div className="lg:hidden">
										<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
											{sectionNavItems[4].number} {chapterFive.chapterLabel}
										</p>
									</div>
									<h2 className="mt-4 max-w-3xl font-[family:var(--font-serif)] text-3xl font-semibold text-white sm:text-4xl">
										{chapterFive.title}
									</h2>

									<div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
										<div
											id={chapterFive.subsections[0].id}
											className="scroll-mt-28 max-w-3xl"
										>
											<h3 className="font-[family:var(--font-serif)] text-2xl font-semibold text-white">
												{chapterFive.subsections[0].title}
											</h3>
											<ParagraphGroup
												paragraphs={chapterFive.subsections[0].paragraphs}
												className="mt-6"
											/>
										</div>

										{chapterFive.aside ? (
											<div className="border-l border-white/10 pl-5 sm:pl-6">
												<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/75">
													{chapterFive.aside.eyebrow}
												</p>
												<p className="mt-3 font-[family:var(--font-serif)] text-2xl font-semibold text-white">
													{chapterFive.aside.title}
												</p>
												<p className="mt-4 text-sm leading-7 text-slate-300">
													{chapterFive.aside.body}
												</p>
											</div>
										) : null}
									</div>

									<PersonaStrip personas={branchingAiChatPersonas} />

									<div className="mt-12">
										<AudienceRolesWidget />
									</div>
								</div>
							</section>

							<section
								id={conclusionSection.id}
								className={laterChapterLayoutClass}
							>
								<ChapterRail
									number={sectionNavItems[5].number}
									label={conclusionSection.chapterLabel}
								/>
								<div>
									<div className="lg:hidden">
										<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
											{sectionNavItems[5].number}{' '}
											{conclusionSection.chapterLabel}
										</p>
									</div>
									<h2 className="mt-4 max-w-3xl font-[family:var(--font-serif)] text-3xl font-semibold text-white sm:text-4xl">
										{conclusionSection.title}
									</h2>

									<div
										id={conclusionSection.subsections[0].id}
										className="scroll-mt-28 mt-10 max-w-3xl"
									>
										<h3 className="font-[family:var(--font-serif)] text-2xl font-semibold text-white">
											{conclusionSection.subsections[0].title}
										</h3>
										<ParagraphGroup
											paragraphs={conclusionSection.subsections[0].paragraphs}
											className="mt-6"
										/>
									</div>

									<div className="mt-12">
										<BranchingQuizWidget />
									</div>

									<ArticleFooterCta
										eyebrow={branchingAiChatFooterCta.eyebrow}
										title={branchingAiChatFooterCta.title}
										description={branchingAiChatFooterCta.description}
										primaryHref={branchingAiChatFooterCta.primaryHref}
										primaryLabel={branchingAiChatFooterCta.primaryLabel}
										secondaryHref={branchingAiChatFooterCta.secondaryHref}
										secondaryLabel={branchingAiChatFooterCta.secondaryLabel}
									/>
								</div>
							</section>
						</article>

						<aside className="hidden xl:block xl:sticky xl:top-28 xl:self-start">
							<SectionSpyNav items={sectionNavItems} mode="desktop" />
						</aside>
					</div>
				</div>
			</div>
		</AuroraBackground>
	)
}
