'use client'

import { FeedbackModal } from '@/components/chat/feedback-modal'
import { MarketplacePostDialog } from '@/components/chat/marketplace-post-dialog'
import { MarkdownRenderer } from '@/components/chat/markdown-renderer'
import { useSettings } from '@/hooks/use-settings'
import { type Message } from '@/hooks/use-chat'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	Bot,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Copy,
	FileText,
	ImageIcon,
	Info,
	Pencil,
	RefreshCw,
	ShieldCheck,
	Square,
	Sparkles,
	ThumbsDown,
	ThumbsUp,
	Store,
	Wrench,
	X,
} from 'lucide-react'
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type MutableRefObject,
	useEffect,
	useRef,
	useState,
} from 'react'

interface SiblingNav {
	currentIndex: number
	totalCount: number
	onPrevious: () => void
	onNext: () => void
	disabled?: boolean
}

export interface MessageBubbleProps {
	message: Message
	onRetry: (messageId: string) => void
	onStop: () => void
	onEdit: (messageId: string, newContent: string) => void
	isStreaming: boolean
	siblingNav?: SiblingNav
	isActive?: boolean
	isSelected?: boolean
	onToggleSelection?: () => void
	onEditParent?: (messageId: string) => void
	editHandlersRef?: MutableRefObject<Map<string, () => void>>
	disableMutatingActions?: boolean
	conversationId?: string | null
}

function StreamingText({ content }: { content: string }) {
	const trailingMatch = content.match(/(\s*)$/)
	const trailing = trailingMatch ? trailingMatch[0] : ''
	const withoutTrailing = content.slice(0, content.length - trailing.length)

	const lastSpaceIndex = Math.max(
		withoutTrailing.lastIndexOf(' '),
		withoutTrailing.lastIndexOf('\n'),
		withoutTrailing.lastIndexOf('\t')
	)

	const stable =
		lastSpaceIndex >= 0 ? withoutTrailing.slice(0, lastSpaceIndex + 1) : ''
	const currentWord =
		lastSpaceIndex >= 0
			? withoutTrailing.slice(lastSpaceIndex + 1)
			: withoutTrailing

	return (
		<span className="whitespace-pre-wrap">
			{stable}
			<span>{currentWord}</span>
			<span className="ml-1 inline-block h-5 w-1 animate-pulse bg-primary" />
			{trailing}
		</span>
	)
}

const EVIDENCE_LABELS: Record<string, string> = {
	grounded: 'Grounded',
	partially_grounded: 'Partially grounded',
	no_file_evidence: 'No file evidence',
	model_only: 'Model-only',
	used_web_search: 'Used web search',
}

const PROGRESS_LABELS: Record<string, string> = {
	preparing_context: 'Preparing context',
	retrieving_files: 'Retrieving files',
	running_tools: 'Running tools',
	generating_answer: 'Generating answer',
	validating_output: 'Validating output',
}

function getEvidenceLabel(value: string | null | undefined) {
	return value ? (EVIDENCE_LABELS[value] ?? value) : 'Model-only'
}

function getProgressLabel(value: string | null | undefined) {
	return value ? (PROGRESS_LABELS[value] ?? value) : null
}

function getEvidenceCaveat(value: string | null | undefined) {
	if (value === 'partially_grounded') {
		return 'Partially grounded. Check the listed sources before relying on this answer.'
	}
	if (value === 'no_file_evidence' || value === 'model_only') {
		return 'No file evidence was found for this answer. Ask a follow-up or retry with web search when available.'
	}
	return null
}

function getUniqueSources(
	citations: Message['citations'] | undefined
): Array<{ key: string; label: string; indexes: number[] }> {
	const sources = new Map<
		string,
		{ key: string; label: string; indexes: number[] }
	>()
	for (const citation of citations ?? []) {
		const key = `${citation.fileId}:${citation.sourceLabel}`
		const existing = sources.get(key)
		if (existing) {
			existing.indexes.push(citation.index)
			continue
		}
		sources.set(key, {
			key,
			label: citation.sourceLabel,
			indexes: [citation.index],
		})
	}
	return [...sources.values()]
}

export function MessageBubble({
	message,
	onRetry,
	onStop,
	onEdit,
	isStreaming,
	siblingNav,
	isActive = false,
	isSelected = false,
	onToggleSelection,
	onEditParent,
	editHandlersRef,
	disableMutatingActions = false,
	conversationId = null,
}: MessageBubbleProps) {
	const isUser = message.role === 'user'
	const isAssistant = message.role === 'assistant'
	const [isEditing, setIsEditing] = useState(false)
	const [isExpanded, setIsExpanded] = useState(false)
	const [editContent, setEditContent] = useState(message.content)
	const [copied, setCopied] = useState(false)
	const [feedbackGiven, setFeedbackGiven] = useState<'good' | 'bad' | null>(
		null
	)
	const [showFeedbackModal, setShowFeedbackModal] = useState(false)
	const [showMarketplaceDialog, setShowMarketplaceDialog] = useState(false)
	const [showRunDetails, setShowRunDetails] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const { settings } = useSettings()
	const trace = message.trustTrace
	const progressLabel = getProgressLabel(message.progressStep)
	const evidenceLabel = getEvidenceLabel(trace?.evidenceState)
	const evidenceCaveat = getEvidenceCaveat(trace?.evidenceState)
	const fallbackUsed = Boolean(trace?.fallbackUsed)
	const resolvedModel =
		trace?.resolvedModel && trace.resolvedModel !== message.model
			? trace.resolvedModel
			: null
	const uniqueSources = getUniqueSources(message.citations)

	useEffect(() => {
		if (isUser && editHandlersRef) {
			editHandlersRef.current.set(message.id, () => setIsEditing(true))
			return () => {
				editHandlersRef.current.delete(message.id)
			}
		}
	}, [editHandlersRef, isUser, message.id])

	const hasEditedVersions = siblingNav && siblingNav.totalCount > 1
	const shouldTruncate =
		isUser &&
		!isEditing &&
		message.content.length > settings.messageTruncateLength
	const displayContent =
		shouldTruncate && !isExpanded
			? `${message.content.slice(0, settings.messageTruncateLength)}...`
			: message.content

	useEffect(() => {
		if (isEditing && textareaRef.current) {
			textareaRef.current.focus()
			textareaRef.current.setSelectionRange(
				textareaRef.current.value.length,
				textareaRef.current.value.length
			)
		}
	}, [isEditing])

	const handleSaveEdit = () => {
		if (disableMutatingActions) return
		if (editContent.trim() && editContent !== message.content) {
			onEdit(message.id, editContent)
		}
		setIsEditing(false)
	}

	const handleCancelEdit = () => {
		setEditContent(message.content)
		setIsEditing(false)
	}

	const handleKeyDown = (event: ReactKeyboardEvent) => {
		if (disableMutatingActions) {
			if (event.key === 'Escape') {
				handleCancelEdit()
			}
			return
		}

		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			handleSaveEdit()
		} else if (event.key === 'Escape') {
			handleCancelEdit()
		}
	}

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(message.content)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy:', error)
		}
	}

	const handleFeedback = async (type: 'good' | 'bad') => {
		setFeedbackGiven(type)
		if (type === 'bad') {
			setShowFeedbackModal(true)
			return
		}

		try {
			await fetch('/api/chat/feedback', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('feedback'),
				},
				body: JSON.stringify({
					messageId: message.id,
					type: 'good',
					reasons: [],
					comment: '',
				}),
			})
		} catch (error) {
			console.error('Failed to submit feedback:', error)
		}
	}

	const handleFeedbackSubmit = async (
		reasons: string[],
		comment: string,
		correction?: string
	) => {
		try {
			await fetch('/api/chat/feedback', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('feedback'),
				},
				body: JSON.stringify({
					messageId: message.id,
					type: 'bad',
					reasons,
					comment,
					correction: correction ?? '',
				}),
			})
		} catch (error) {
			console.error('Failed to submit feedback:', error)
			throw error
		}
	}

	return (
		<>
			<FeedbackModal
				isOpen={showFeedbackModal}
				onClose={() => setShowFeedbackModal(false)}
				onSubmit={handleFeedbackSubmit}
			/>
			{conversationId && isAssistant ? (
				<MarketplacePostDialog
					open={showMarketplaceDialog}
					onOpenChange={setShowMarketplaceDialog}
					conversationId={conversationId}
					message={message}
				/>
			) : null}

			<div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
				<div
					id={`message-${message.id}`}
					className={cn(
						'relative max-w-full overflow-hidden rounded-2xl px-6 py-4 transition-all group',
						isUser
							? 'ml-auto border border-[#57FCFF]/20 bg-[#57FCFF]/10'
							: 'border border-border/50 bg-[#1a2029]/50',
						message.isError && 'border-destructive/50 bg-destructive/5',
						isActive && 'ring-2 ring-primary/50 shadow-lg shadow-primary/20'
					)}
				>
					{onToggleSelection ? (
						<button
							onClick={onToggleSelection}
							className="absolute -left-10 top-4 opacity-0 transition-opacity group-hover:opacity-100"
							title="Select message"
						>
							<div
								className={cn(
									'flex h-4 w-4 items-center justify-center rounded border-2 transition-colors',
									isSelected
										? 'border-primary bg-primary'
										: 'border-muted-foreground/50 hover:border-primary'
								)}
							>
								{isSelected ? (
									<Check className="h-3 w-3 text-primary-foreground" />
								) : null}
							</div>
						</button>
					) : null}

					{isAssistant && message.model ? (
						<div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							<Bot className="h-3 w-3" />
							{message.model}
							{message.activeSkillTrace?.items.length ? (
								<span
									className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-primary"
									title={message.activeSkillTrace.items
										.map(
											(skill) =>
												`${skill.title} (${skill.templateId}@${skill.versionId})`
										)
										.join(', ')}
								>
									<Sparkles className="h-3 w-3" />
									{message.activeSkillTrace.items.length === 1
										? message.activeSkillTrace.items[0].title
										: `${message.activeSkillTrace.items.length} skills`}
								</span>
							) : null}
							{fallbackUsed ? (
								<span
									className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-amber-300"
									title={
										resolvedModel
											? `Resolved model: ${resolvedModel}`
											: 'Provider fallback was used'
									}
								>
									<RefreshCw className="h-3 w-3" />
									Fallback
								</span>
							) : null}
							<span
								className="inline-flex items-center gap-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-muted-foreground"
								title="Evidence state"
							>
								<ShieldCheck className="h-3 w-3" />
								{evidenceLabel}
							</span>
							{progressLabel ? (
								<span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-primary">
									<Sparkles className="h-3 w-3" />
									{progressLabel}
								</span>
							) : null}
							{message.isStreaming ? (
								<button
									onClick={onStop}
									className="group rounded p-1 transition-colors hover:bg-destructive/20"
									title="Stop generating"
								>
									<Square className="h-3 w-3 fill-current text-muted-foreground group-hover:text-destructive" />
								</button>
							) : null}
						</div>
					) : null}

					<div
						data-message-content="true"
						data-message-id={message.id}
						data-selection-disabled={isUser && isEditing ? 'true' : undefined}
						className="leading-relaxed text-foreground"
					>
						{isEditing && isUser ? (
							<div className="min-w-[100px] max-w-full space-y-2 w-fit">
								<div className="grid leading-relaxed">
									<div className="invisible col-start-1 row-start-1 min-h-[60px] whitespace-pre-wrap break-words border border-transparent px-3 py-2 text-foreground">
										{editContent}{' '}
									</div>
									<textarea
										ref={textareaRef}
										value={editContent}
										onChange={(event) => setEditContent(event.target.value)}
										onKeyDown={handleKeyDown}
										className="col-start-1 row-start-1 h-full w-full resize-none overflow-hidden rounded-lg border border-primary/30 bg-transparent px-3 py-2 leading-relaxed text-foreground focus:border-primary focus:outline-none"
										placeholder="Edit your message..."
									/>
								</div>
								<div className="flex justify-end gap-2">
									<button
										onClick={handleCancelEdit}
										className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
									>
										<X className="h-3 w-3" />
										Cancel
									</button>
									<button
										onClick={handleSaveEdit}
										disabled={disableMutatingActions}
										className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
									>
										<Check className="h-3 w-3" />
										Save & Resend
									</button>
								</div>
							</div>
						) : message.content ? (
							isAssistant ? (
								message.isStreaming ? (
									<StreamingText content={message.content} />
								) : (
									<MarkdownRenderer content={message.content} />
								)
							) : (
								<div
									onClick={() => {
										if (window.getSelection()?.toString().trim()) {
											return
										}
										if (!isEditing && !disableMutatingActions) {
											setIsEditing(true)
										}
									}}
									className={cn(
										'transition-opacity',
										disableMutatingActions
											? 'cursor-default'
											: 'cursor-pointer hover:opacity-80'
									)}
									title={disableMutatingActions ? undefined : 'Click to edit'}
								>
									<span className="whitespace-pre-wrap">{displayContent}</span>
									{shouldTruncate ? (
										<button
											onClick={(event) => {
												event.stopPropagation()
												setIsExpanded(!isExpanded)
											}}
											className="ml-2 inline-flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
										>
											{isExpanded ? 'Show less' : 'Show more'}
											<ChevronDown
												className={cn(
													'h-3 w-3 transition-transform',
													isExpanded && 'rotate-180'
												)}
											/>
										</button>
									) : null}
								</div>
							)
						) : (
							<div className="flex items-start gap-3 rounded-lg border border-border/30 bg-[#1a1d24]/50 p-3">
								<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
								<div className="flex-1">
									<div className="text-sm text-muted-foreground">
										{message.isStreaming ? (
											<span className="italic">Thinking...</span>
										) : (
											<>
												<div className="mb-1 font-medium">
													No response generated
												</div>
												<div className="text-xs opacity-70">
													The AI returned an empty response. This might be due
													to a network issue or API limitation.
												</div>
											</>
										)}
									</div>
									{!message.isStreaming && isAssistant ? (
										<button
											onClick={() => onRetry(message.id)}
											disabled={disableMutatingActions}
											className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
										>
											<RefreshCw className="h-3 w-3" />
											Try Again
										</button>
									) : null}
								</div>
							</div>
						)}
					</div>

					{isUser && !isEditing && message.attachments?.length ? (
						<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/30 pt-3">
							{message.attachments.map((attachment) => {
								const imageUrl =
									attachment.contentUrl ??
									`/api/attachments/${attachment.fileObjectId}/content`

								return attachment.kind === 'image' ? (
									<div
										key={attachment.id}
										className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/50 bg-background/30 px-2 py-1 text-[11px] text-muted-foreground"
									>
										{imageUrl ? (
											<img
												src={imageUrl}
												alt=""
												className="h-8 w-8 shrink-0 rounded object-cover"
											/>
										) : (
											<ImageIcon className="h-4 w-4 shrink-0 text-primary" />
										)}
										<div className="min-w-0">
											<div className="max-w-40 truncate text-foreground">
												{attachment.filename}
											</div>
											<div className="text-[10px] uppercase text-muted-foreground">
												Vision
											</div>
										</div>
									</div>
								) : (
									<div
										key={attachment.id}
										className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/50 bg-background/30 px-2 py-1 text-[11px] text-muted-foreground"
									>
										<FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
										<span className="max-w-44 truncate text-foreground">
											{attachment.filename}
										</span>
										<span>Document</span>
									</div>
								)
							})}
						</div>
					) : null}

					{isAssistant && message.citations?.length ? (
						<div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/30 pt-3">
							{message.citations.map((citation) => (
								<span
									key={citation.chunkId}
									className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/50 bg-background/30 px-2 py-1 text-[11px] text-muted-foreground"
								>
									<FileText className="h-3 w-3 shrink-0 text-primary" />
									<span className="font-medium text-foreground">
										[{citation.index}]
									</span>
									<span className="max-w-44 truncate">
										{citation.sourceLabel}
										{citation.pageNumber ? ` p.${citation.pageNumber}` : ''}
									</span>
								</span>
							))}
						</div>
					) : null}

					{isAssistant && evidenceCaveat ? (
						<div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
							{evidenceCaveat}
						</div>
					) : null}

					{isAssistant && !message.isStreaming ? (
						<div className="mt-3 border-t border-border/30 pt-3">
							<button
								type="button"
								onClick={() => setShowRunDetails((value) => !value)}
								className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
								aria-expanded={showRunDetails}
							>
								<Info className="h-3.5 w-3.5" />
								Run details
								<ChevronDown
									className={cn(
										'h-3.5 w-3.5 transition-transform',
										showRunDetails && 'rotate-180'
									)}
								/>
							</button>
							{showRunDetails ? (
								<div className="mt-2 space-y-3 rounded-lg border border-border/40 bg-background/25 p-3 text-xs text-muted-foreground">
									<div className="grid gap-2 sm:grid-cols-2">
										<div>
											<div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
												Model
											</div>
											<div className="text-foreground">
												{message.model ?? trace?.selectedModel ?? 'Unknown'}
											</div>
											{resolvedModel ? (
												<div className="text-[11px] text-amber-300">
													Resolved to {resolvedModel}
												</div>
											) : null}
										</div>
										<div>
											<div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
												Trace ID
											</div>
											<div className="font-mono text-[11px] text-foreground">
												{trace?.traceId ?? trace?.generationId ?? 'Unavailable'}
											</div>
										</div>
										<div>
											<div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
												Context
											</div>
											<div>
												{trace?.promptVersion ?? 'Unknown prompt version'}
												{trace?.context.summaryUsed ? ' with summary' : ''}
											</div>
										</div>
										<div>
											<div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
												Status
											</div>
											<div>
												{trace?.generationStatus ??
													message.status ??
													'completed'}
											</div>
										</div>
									</div>

									<div>
										<div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
											Sources
										</div>
										{uniqueSources.length ? (
											<div className="flex flex-wrap gap-1.5">
												{uniqueSources.map((source) => (
													<span
														key={source.key}
														className="inline-flex max-w-full items-center gap-1 rounded border border-border/40 bg-background/40 px-2 py-1"
													>
														<FileText className="h-3 w-3 shrink-0 text-primary" />
														<span className="max-w-48 truncate text-foreground">
															{source.label}
														</span>
														<span>[{source.indexes.join(', ')}]</span>
													</span>
												))}
											</div>
										) : (
											<div>No file evidence found for this answer.</div>
										)}
									</div>

									<div>
										<div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
											Tools and skills
										</div>
										<div className="flex flex-wrap gap-1.5">
											{trace?.usedTools.length ? (
												trace.usedTools.map((tool) => (
													<span
														key={tool.id}
														className="inline-flex items-center gap-1 rounded border border-border/40 bg-background/40 px-2 py-1"
													>
														<Wrench className="h-3 w-3 text-primary" />
														{tool.name} · {tool.status}
													</span>
												))
											) : (
												<span>No tools used</span>
											)}
											{trace?.activeSkills.length
												? trace.activeSkills.map((skill) => (
														<span
															key={`${skill.templateId}:${skill.versionId}`}
															className="inline-flex items-center gap-1 rounded border border-border/40 bg-background/40 px-2 py-1"
														>
															<Sparkles className="h-3 w-3 text-primary" />
															{skill.title}
														</span>
													))
												: null}
										</div>
									</div>
								</div>
							) : null}
						</div>
					) : null}

					{isUser && !isEditing && !isStreaming ? (
						<button
							onClick={() => {
								if (!disableMutatingActions) {
									setIsEditing(true)
								}
							}}
							disabled={disableMutatingActions}
							className="absolute -left-8 top-1/2 rounded-lg bg-background/50 p-1.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-background disabled:cursor-not-allowed disabled:opacity-30"
							title={
								disableMutatingActions
									? 'Queue must finish before editing'
									: 'Edit message'
							}
						>
							<Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
						</button>
					) : null}

					{siblingNav && siblingNav.totalCount > 1 ? (
						<div className="mt-2 flex items-center justify-between border-t border-border/30 pt-2">
							<span className="text-xs text-muted-foreground">
								Version {siblingNav.currentIndex} of {siblingNav.totalCount}
							</span>
							<div className="flex items-center gap-1">
								<button
									onClick={siblingNav.onPrevious}
									disabled={
										siblingNav.disabled || siblingNav.currentIndex === 1
									}
									className="rounded p-1 transition-colors hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent"
									title="Previous version"
								>
									<ChevronLeft className="h-3.5 w-3.5" />
								</button>
								<button
									onClick={siblingNav.onNext}
									disabled={
										siblingNav.disabled ||
										siblingNav.currentIndex === siblingNav.totalCount
									}
									className="rounded p-1 transition-colors hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent"
									title="Next version"
								>
									<ChevronRight className="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					) : null}

					{hasEditedVersions && !isEditing ? (
						<div className="mt-2">
							<span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
								<Pencil className="h-3 w-3" />
								Edited
							</span>
						</div>
					) : null}

					{message.isError && !message.isStreaming ? (
						<div className="mt-3 flex items-center gap-2 border-t border-destructive/20 pt-3">
							<AlertCircle className="h-4 w-4 text-destructive" />
							<span className="text-sm text-destructive">
								Failed to generate
							</span>
							<button
								onClick={() => onRetry(message.id)}
								disabled={disableMutatingActions}
								className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
							>
								<RefreshCw className="h-3 w-3" />
								Retry
							</button>
						</div>
					) : null}

					{message.isStopped && !message.isStreaming && isAssistant ? (
						<div className="mt-3 flex items-center gap-2 border-t border-border/30 pt-3">
							<span className="text-xs text-muted-foreground">
								Generation stopped
							</span>
							<button
								onClick={() => onRetry(message.id)}
								disabled={disableMutatingActions}
								className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
							>
								<RefreshCw className="h-3 w-3" />
								Continue
							</button>
						</div>
					) : null}

					{isAssistant && !message.isStreaming && message.completionTokens ? (
						<div className="mt-2 font-mono text-[10px] text-muted-foreground/50">
							{message.promptTokens} → {message.completionTokens} tokens
						</div>
					) : null}
				</div>
			</div>

			{isAssistant && !message.isStreaming && message.content ? (
				<div className="mt-2 flex items-center justify-start gap-1">
					{message.parentMessageId && onEditParent ? (
						<button
							onClick={() => {
								if (!disableMutatingActions) {
									onEditParent(message.parentMessageId!)
								}
							}}
							disabled={disableMutatingActions}
							className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
							title={
								disableMutatingActions
									? 'Queue must finish before editing'
									: 'Edit prompt'
							}
						>
							<Pencil className="h-3.5 w-3.5" />
							Edit
						</button>
					) : null}
					<button
						onClick={handleCopy}
						className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
						title="Copy response"
					>
						{copied ? (
							<Check className="h-3.5 w-3.5" />
						) : (
							<Copy className="h-3.5 w-3.5" />
						)}
						{copied ? 'Copied' : 'Copy'}
					</button>
					{conversationId ? (
						<button
							onClick={() => setShowMarketplaceDialog(true)}
							disabled={disableMutatingActions}
							className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
							title="Post to Marketplace"
						>
							<Store className="h-3.5 w-3.5" />
							Post
						</button>
					) : null}
					<button
						onClick={() => void handleFeedback('good')}
						disabled={feedbackGiven === 'good'}
						className={cn(
							'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
							feedbackGiven === 'good'
								? 'bg-green-500/10 text-green-500'
								: 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
						)}
						title="Good response"
					>
						<ThumbsUp className="h-3.5 w-3.5" />
					</button>
					<button
						onClick={() => void handleFeedback('bad')}
						disabled={feedbackGiven === 'bad'}
						className={cn(
							'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
							feedbackGiven === 'bad'
								? 'bg-red-500/10 text-red-500'
								: 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
						)}
						title="Bad response"
					>
						<ThumbsDown className="h-3.5 w-3.5" />
					</button>
					<button
						onClick={() => onRetry(message.id)}
						disabled={disableMutatingActions}
						className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
						title={
							disableMutatingActions
								? 'Queue must finish before retrying'
								: 'Retry generation'
						}
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Retry
					</button>
				</div>
			) : null}

			{isUser && !isEditing ? (
				<button
					data-edit-trigger
					onClick={() => setIsEditing(true)}
					className="hidden"
					aria-hidden="true"
				/>
			) : null}
		</>
	)
}
