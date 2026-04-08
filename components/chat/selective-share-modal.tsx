'use client'

import { Button } from '@/components/ui/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Message } from '@/hooks/use-chat'
import { useToast } from '@/hooks/use-toast'
import { applyApprovedShareMasking, FULL_MESSAGE_REDACTION } from '@/lib/share/masking'
import type {
	ShareDraftMessage,
	SharePreviewResponse,
	ShareSummaryData,
} from '@/lib/share/types'
import { cn } from '@/lib/utils'
import {
	AlertTriangle,
	Bot,
	ChevronDown,
	Check,
	Copy,
	Eye,
	EyeOff,
	Link2,
	Linkedin,
	Loader2,
	Mail,
	RefreshCw,
	Share2,
	Sparkles,
	Twitter,
	User,
	X,
} from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface SelectiveShareModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	conversationId: string
	conversationTitle: string
	selectedMessageIds: string[]
	allMessages: Message[]
	onAutoCompletePairs?: (messageIds: string[]) => void
}

interface PairWarning {
	messageId: string
	missingRole: 'user' | 'assistant'
	partnerId?: string
}

type ExpiresIn = 7 | 30 | null
type Step = 'review' | 'done'

const SUMMARY_REFRESH_MESSAGE =
	'Summary was cleared after privacy changes. Refresh the preview to regenerate it.'
const PREVIEW_COLLAPSE_MAX_CHARACTERS = 480
const PREVIEW_COLLAPSE_MAX_LINES = 8

export function SelectiveShareModal({
	open,
	onOpenChange,
	conversationId,
	conversationTitle,
	selectedMessageIds,
	allMessages,
	onAutoCompletePairs,
}: SelectiveShareModalProps) {
	const { toast } = useToast()
	const [step, setStep] = useState<Step>('review')
	const [isPreparing, setIsPreparing] = useState(false)
	const [isPublishing, setIsPublishing] = useState(false)
	const [isRevoking, setIsRevoking] = useState(false)
	const [shareUrl, setShareUrl] = useState<string | null>(null)
	const [shareToken, setShareToken] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [draftMessages, setDraftMessages] = useState<ShareDraftMessage[]>([])
	const [redactedIds, setRedactedIds] = useState<Set<string>>(new Set())
	const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set())
	const [summary, setSummary] = useState<ShareSummaryData | null>(null)
	const [summaryWarning, setSummaryWarning] = useState<string | null>(null)

	const [shareTitle, setShareTitle] = useState(conversationTitle)
	const [expiresIn, setExpiresIn] = useState<ExpiresIn>(null)
	const [allowDownload, setAllowDownload] = useState(false)
	const [showTimestamps, setShowTimestamps] = useState(true)
	const [showModel, setShowModel] = useState(true)
	const [autoMaskPII, setAutoMaskPII] = useState(true)
	const [generateSummary, setGenerateSummary] = useState(false)

	const draftMessagesRef = useRef<ShareDraftMessage[]>([])
	const redactedIdsRef = useRef<Set<string>>(new Set())

	const orderedSelectedMessages = useMemo(() => {
		const selectedSet = new Set(selectedMessageIds)
		return allMessages
			.filter(
				(message) =>
					selectedSet.has(message.id) &&
					(message.role === 'user' || message.role === 'assistant')
			)
			.sort((a, b) => {
				const at = a.createdAt?.getTime() ?? 0
				const bt = b.createdAt?.getTime() ?? 0
				return at - bt
			})
	}, [allMessages, selectedMessageIds])

	const selectedSignature = useMemo(
		() => orderedSelectedMessages.map((message) => message.id).join('|'),
		[orderedSelectedMessages]
	)

	useEffect(() => {
		draftMessagesRef.current = draftMessages
	}, [draftMessages])

	useEffect(() => {
		redactedIdsRef.current = redactedIds
	}, [redactedIds])

	useEffect(() => {
		const availableIds = new Set(draftMessages.map((message) => message.id))
		setExpandedMessageIds((current) => {
			const next = new Set(Array.from(current).filter((id) => availableIds.has(id)))
			return next.size === current.size ? current : next
		})
	}, [draftMessages])

	useEffect(() => {
		setShareTitle(conversationTitle)
	}, [conversationTitle, open])

	useEffect(() => {
		const selectedSet = new Set(orderedSelectedMessages.map((message) => message.id))
		setRedactedIds((current) => {
			const next = new Set(Array.from(current).filter((id) => selectedSet.has(id)))
			redactedIdsRef.current = next
			return next
		})
	}, [selectedSignature, orderedSelectedMessages])

	const warnings = usePairAnalysis(selectedMessageIds, allMessages)

	const handleAutoCompletePairs = useCallback(() => {
		const missingIds = warnings
			.map((warning) => warning.partnerId)
			.filter((id): id is string => !!id)

		if (missingIds.length > 0) {
			onAutoCompletePairs?.(missingIds)
		}
	}, [onAutoCompletePairs, warnings])

	const clearSummaryAfterPrivacyChange = useCallback(() => {
		if (!generateSummary) return
		setSummary(null)
		setSummaryWarning(SUMMARY_REFRESH_MESSAGE)
	}, [generateSummary])

	const refreshPreview = useCallback(async () => {
		if (!conversationId || orderedSelectedMessages.length === 0) {
			setDraftMessages([])
			setSummary(null)
			return
		}

		setIsPreparing(true)
		try {
			const approvedFindingIdsByMessageId = Object.fromEntries(
				draftMessagesRef.current.map((message) => [message.id, message.approvedFindingIds])
			)
			const response = await fetch('/api/chat/share/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId,
					selectedMessageIds: orderedSelectedMessages.map((message) => message.id),
					autoMaskPII,
					generateSummary,
					approvedFindingIdsByMessageId,
					redactedMessageIds: Array.from(redactedIdsRef.current),
				}),
			})

			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.error ?? 'Failed to prepare share preview')
			}

			const data: SharePreviewResponse = await response.json()
			setDraftMessages(data.messages)
			setSummary(data.summary)
			setSummaryWarning(data.summaryWarning)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to prepare share preview'
			toast({ title: 'Preview failed', description: message, variant: 'destructive' })
		} finally {
			setIsPreparing(false)
		}
	}, [autoMaskPII, conversationId, generateSummary, orderedSelectedMessages, toast])

	useEffect(() => {
		if (!open) return
		void refreshPreview()
	}, [open, selectedSignature, autoMaskPII, generateSummary, refreshPreview])

	const toggleWholeMessageRedaction = useCallback(
		(messageId: string) => {
			setRedactedIds((current) => {
				const next = new Set(current)
				if (next.has(messageId)) next.delete(messageId)
				else next.add(messageId)
				redactedIdsRef.current = next
				return next
			})
			clearSummaryAfterPrivacyChange()
		},
		[clearSummaryAfterPrivacyChange]
	)

	const toggleFinding = useCallback(
		(messageId: string, findingId: string) => {
			setDraftMessages((current) =>
				current.map((message) => {
					if (message.id !== messageId) return message

					const approvedFindingIds = message.approvedFindingIds.includes(findingId)
						? message.approvedFindingIds.filter((id) => id !== findingId)
						: [...message.approvedFindingIds, findingId]

					return {
						...message,
						approvedFindingIds,
						maskedContent: applyApprovedShareMasking(
							message.originalContent,
							message.findings,
							approvedFindingIds
						),
					}
				})
			)
			clearSummaryAfterPrivacyChange()
		},
		[clearSummaryAfterPrivacyChange]
	)

	const toggleExpandedMessage = useCallback((messageId: string, expanded: boolean) => {
		setExpandedMessageIds((current) => {
			const next = new Set(current)
			if (expanded) next.add(messageId)
			else next.delete(messageId)
			return next
		})
	}, [])

	const handlePublish = useCallback(async () => {
		if (!conversationId || draftMessages.length === 0) return

		setIsPublishing(true)
		try {
			const response = await fetch('/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId,
					title: shareTitle || conversationTitle,
					expiresIn,
					allowDownload,
					showTimestamps,
					showModel,
					autoMaskPII,
					summary: generateSummary ? summary : null,
					messageSelections: draftMessages.map((message) => ({
						id: message.id,
						approvedFindingIds: message.approvedFindingIds,
						redactWholeMessage: redactedIds.has(message.id),
					})),
				}),
			})

			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.error ?? 'Failed to create share link')
			}

			const data = await response.json()
			setShareUrl(data.shareUrl)
			setShareToken(data.shareToken)
			setStep('done')
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to create share link'
			toast({ title: 'Publish failed', description: message, variant: 'destructive' })
		} finally {
			setIsPublishing(false)
		}
	}, [
		allowDownload,
		autoMaskPII,
		conversationId,
		conversationTitle,
		draftMessages,
		expiresIn,
		generateSummary,
		redactedIds,
		shareTitle,
		showModel,
		showTimestamps,
		summary,
		toast,
	])

	const handleCopy = useCallback(async () => {
		if (!shareUrl) return
		try {
			await navigator.clipboard.writeText(shareUrl)
			setCopied(true)
			toast({ title: 'Link copied', description: 'Share link copied to clipboard.' })
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast({ title: 'Failed to copy', variant: 'destructive' })
		}
	}, [shareUrl, toast])

	const handleShareVia = useCallback(
		(platform: 'twitter' | 'linkedin' | 'email') => {
			if (!shareUrl) return

			const encodedUrl = encodeURIComponent(shareUrl)
			const encodedText = encodeURIComponent(`Check out this shared conversation: ${shareTitle}`)

			if (platform === 'twitter') {
				window.open(
					`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
					'_blank',
					'noopener,noreferrer'
				)
				return
			}

			if (platform === 'linkedin') {
				window.open(
					`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
					'_blank',
					'noopener,noreferrer'
				)
				return
			}

			window.location.href = `mailto:?subject=${encodedText}&body=${encodedUrl}`
		},
		[shareTitle, shareUrl]
	)

	const handleRevoke = useCallback(async () => {
		if (!shareToken) return

		setIsRevoking(true)
		try {
			const response = await fetch(`/api/share/${shareToken}`, { method: 'DELETE' })
			if (!response.ok) throw new Error()

			toast({ title: 'Link revoked', description: 'The share link is no longer active.' })
			setShareToken(null)
			setShareUrl(null)
			setStep('review')
		} catch {
			toast({ title: 'Failed to revoke', variant: 'destructive' })
		} finally {
			setIsRevoking(false)
		}
	}, [shareToken, toast])

	const resetState = useCallback(() => {
		setStep('review')
		setShareUrl(null)
		setShareToken(null)
		setCopied(false)
		setDraftMessages([])
		setSummary(null)
		setSummaryWarning(null)
		setRedactedIds(new Set())
		setExpandedMessageIds(new Set())
		setAutoMaskPII(true)
		setGenerateSummary(false)
		setAllowDownload(false)
		setShowTimestamps(true)
		setShowModel(true)
		setExpiresIn(null)
	}, [])

	const handleClose = useCallback(() => {
		onOpenChange(false)
		resetState()
	}, [onOpenChange, resetState])

	const summaryKeyPointsText = summary?.keyPoints.join('\n') ?? ''
	const displaySwitchClassName =
		'data-[state=checked]:border-[#57FCFF]/50 data-[state=checked]:bg-[#57FCFF] data-[state=unchecked]:bg-sidebar dark:data-[state=unchecked]:bg-sidebar'

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) handleClose()
			}}
		>
			<DialogContent className="grid h-[92vh] max-h-[92vh] grid-rows-[auto,minmax(0,1fr),auto] overflow-hidden border border-primary/20 bg-popover p-0 sm:max-w-5xl">
				<DialogHeader className="gap-2 border-b border-border/50 px-6 py-5 pr-14">
					<DialogTitle className="flex items-center gap-2 text-foreground">
						<Share2 className="h-5 w-5 text-[#57FCFF]" />
						Share Selected Messages
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{step === 'review'
							? `Review ${draftMessages.length || orderedSelectedMessages.length} selected message${(draftMessages.length || orderedSelectedMessages.length) !== 1 ? 's' : ''}, approve privacy masking, and publish a secure share link.`
							: 'Your share link is ready. Anyone with the link can view this shared thread.'}
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 overflow-y-auto px-6 py-5">
					{step === 'review' ? (
						<div className="flex min-h-0 flex-col gap-6 py-1">
							<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-sidebar/30 p-3">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<Button
										size="sm"
										variant="outline"
										onClick={() => void refreshPreview()}
										disabled={isPreparing || orderedSelectedMessages.length === 0}
										className="border-[#57FCFF]/20 hover:border-[#57FCFF]/40"
									>
										{isPreparing ? (
											<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
										) : (
											<RefreshCw className="mr-2 h-3.5 w-3.5" />
										)}
										Refresh Preview
									</Button>
									<span>Preview is generated server-side and is not saved until you publish.</span>
								</div>
								<div className="flex items-center gap-2">
									<ToggleChip
										label="Auto PII Masking"
										active={autoMaskPII}
										onClick={() => setAutoMaskPII((value) => !value)}
									/>
									<ToggleChip
										label="AI Summary"
										active={generateSummary}
										onClick={() => setGenerateSummary((value) => !value)}
										icon={<Sparkles className="h-3.5 w-3.5" />}
									/>
								</div>
							</div>

							{warnings.length > 0 && (
								<div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
									<div className="min-w-0 flex-1">
										<p className="text-xs font-medium text-yellow-500">
											{warnings.length} message{warnings.length !== 1 ? 's are' : ' is'} missing
											their pair
										</p>
										<p className="mt-0.5 text-xs text-yellow-500/70">
											Sharing without the question or response may lose context.
										</p>
									</div>
									<Button
										size="sm"
										variant="outline"
										className="border-yellow-500/30 text-xs text-yellow-500 hover:bg-yellow-500/10"
										onClick={handleAutoCompletePairs}
									>
										Auto-complete
									</Button>
								</div>
							)}

							<div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
								<section className="min-w-0 rounded-2xl border border-border/50 bg-sidebar/20 p-4">
									<div className="mb-4 flex items-center justify-between gap-3">
										<div>
											<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
												Selected Messages ({draftMessages.length || orderedSelectedMessages.length})
											</Label>
											<p className="mt-1 text-xs text-muted-foreground">
												Review only the content that will be published.
											</p>
										</div>
										{autoMaskPII && (
											<span className="text-[11px] text-muted-foreground">
												Toggle any mask before publishing.
											</span>
										)}
									</div>

									<ScrollArea
										className="h-[360px] rounded-xl border border-border/40 bg-black/10 sm:h-[420px]"
										data-testid="share-preview-scroll-area"
									>
										<div className="space-y-4 p-3 pr-4">
											{draftMessages.map((message) => {
												const isUser = message.role === 'user'
												const isRedacted = redactedIds.has(message.id)
												const displayContent = isRedacted
													? FULL_MESSAGE_REDACTION
													: message.maskedContent
												const collapsible = !isRedacted && shouldCollapsePreview(displayContent)
												const isExpanded = expandedMessageIds.has(message.id)

												return (
													<div
														key={message.id}
														data-testid={`share-preview-card-${message.id}`}
														className={cn(
															'rounded-2xl border p-4 transition-colors',
															isUser
																? 'border-[#57FCFF]/15 bg-[#57FCFF]/8'
																: 'border-white/10 bg-white/5'
														)}
													>
														<div className="mb-3 flex items-start justify-between gap-3">
															<div className="flex min-w-0 items-center gap-2">
																<div
																	className={cn(
																		'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
																		isUser ? 'bg-[#57FCFF]/15' : 'bg-white/10'
																	)}
																>
																	{isUser ? (
																		<User className="h-3.5 w-3.5 text-[#57FCFF]" />
																	) : (
																		<Bot className="h-3.5 w-3.5 text-white/60" />
																	)}
																</div>
																<div className="min-w-0">
																	<p className="text-xs font-semibold uppercase tracking-wider text-white/70">
																		{isUser ? 'You' : message.model || 'Assistant'}
																	</p>
																	<p className="text-[11px] text-white/35">
																		{new Date(message.createdAt).toLocaleString()}
																	</p>
																</div>
															</div>
															<Button
																size="sm"
																variant={isRedacted ? 'default' : 'outline'}
																onClick={() => toggleWholeMessageRedaction(message.id)}
																className={cn(
																	'h-8 px-3 text-xs',
																	isRedacted
																		? 'bg-red-500/20 text-red-200 hover:bg-red-500/30'
																		: 'border-border'
																)}
															>
																{isRedacted ? (
																	<Eye className="mr-2 h-3.5 w-3.5" />
																) : (
																	<EyeOff className="mr-2 h-3.5 w-3.5" />
																)}
																{isRedacted ? 'Show Message' : 'Redact Message'}
															</Button>
														</div>

														<Collapsible
															open={isExpanded}
															onOpenChange={(nextOpen) =>
																toggleExpandedMessage(message.id, nextOpen)
															}
														>
															<CollapsibleContent forceMount className="overflow-visible">
																<div
																	data-testid={`share-preview-body-${message.id}`}
																	className={cn(
																		'relative rounded-xl border p-3 text-sm leading-relaxed',
																		isRedacted
																			? 'border-red-500/20 bg-red-500/5 text-white/45'
																			: 'border-white/10 bg-black/10 text-white/85',
																		collapsible && !isExpanded && 'max-h-40 overflow-hidden'
																	)}
																>
																	<div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
																		{displayContent}
																	</div>
																	{collapsible && !isExpanded && (
																		<div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-xl bg-gradient-to-t from-[#11161f] via-[#11161f]/90 to-transparent" />
																	)}
																</div>
															</CollapsibleContent>

															{collapsible && (
																<div className="mt-2 flex justify-end">
																	<CollapsibleTrigger asChild>
																		<button className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57FCFF] transition-colors hover:text-[#7cf7f9]">
																			{isExpanded ? 'Show less' : 'Show more'}
																			<ChevronDown
																				className={cn(
																					'h-3.5 w-3.5 transition-transform',
																					isExpanded && 'rotate-180'
																				)}
																			/>
																		</button>
																	</CollapsibleTrigger>
																</div>
															)}
														</Collapsible>

														{!isRedacted && message.findings.length > 0 && (
															<div className="mt-4 space-y-2">
																<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
																	Detected Sensitive Content
																</p>
																<div className="flex flex-wrap gap-2">
																	{message.findings.map((finding) => {
																		const active = message.approvedFindingIds.includes(finding.id)
																		return (
																			<button
																				key={finding.id}
																				onClick={() => toggleFinding(message.id, finding.id)}
																				className={cn(
																					'rounded-full border px-3 py-1 text-[11px] transition-colors',
																					active
																						? 'border-[#57FCFF]/40 bg-[#57FCFF]/10 text-[#57FCFF]'
																						: 'border-border bg-sidebar text-muted-foreground'
																				)}
																			>
																				{finding.label}
																			</button>
																		)
																	})}
																</div>
															</div>
														)}
													</div>
												)
											})}

											{!isPreparing && draftMessages.length === 0 && (
												<div className="rounded-xl border border-border/50 bg-sidebar/20 p-4 text-sm text-muted-foreground">
													No shareable messages are selected yet.
												</div>
											)}
										</div>
									</ScrollArea>
								</section>

								<div className="min-w-0 space-y-4">
									<div className="rounded-2xl border border-border/50 bg-sidebar/20 p-4">
										<div className="mb-4 flex items-center justify-between gap-3">
											<div>
												<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
													Share Summary
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Optional. Generated from the reviewed content, not the full chat.
												</p>
											</div>
											{generateSummary && (
												<Button
													size="sm"
													variant="outline"
													onClick={() => void refreshPreview()}
													disabled={isPreparing}
													className="border-[#57FCFF]/20 text-xs"
												>
													{isPreparing ? (
														<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
													) : (
														<RefreshCw className="mr-2 h-3.5 w-3.5" />
													)}
													Refresh Summary
												</Button>
											)}
										</div>

										{generateSummary ? (
											<div className="space-y-3">
												{summaryWarning && (
													<div className="rounded-lg border border-[#57FCFF]/15 bg-[#57FCFF]/5 p-3 text-xs text-[#9ceef1]">
														{summaryWarning}
													</div>
												)}
												<Textarea
													value={summary?.overview ?? ''}
													onChange={(event) =>
														setSummary((current) =>
															current
																? { ...current, overview: event.target.value, edited: true }
																: current
														)
													}
													placeholder="Summary overview"
													className="min-h-[100px] bg-sidebar"
												/>
												<Textarea
													value={summaryKeyPointsText}
													onChange={(event) => {
														const keyPoints = event.target.value
															.split('\n')
															.map((value) => value.trim())
															.filter(Boolean)
														setSummary((current) =>
															current ? { ...current, keyPoints, edited: true } : current
														)
													}}
													placeholder="One key point per line"
													className="min-h-[100px] bg-sidebar"
												/>
											</div>
										) : (
											<div className="rounded-lg border border-dashed border-border bg-sidebar/40 p-4 text-sm text-muted-foreground">
												{generateSummary
													? 'No summary is currently available.'
													: 'Enable AI Summary if you want a short summary and key points on the public share page.'}
											</div>
										)}
									</div>

									<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
										<div className="space-y-4 rounded-2xl border border-border/50 bg-sidebar/20 p-4">
											<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
												Link Settings
											</Label>
											<div className="space-y-1.5">
												<Label className="text-xs text-muted-foreground">Share title</Label>
												<Input
													value={shareTitle}
													onChange={(event) => setShareTitle(event.target.value)}
													placeholder="Conversation title"
													className="bg-sidebar"
												/>
											</div>
											<div className="space-y-1.5">
												<Label className="text-xs text-muted-foreground">Link expiry</Label>
												<div className="flex gap-2">
													{([7, 30, null] as const).map((value) => (
														<button
															key={String(value)}
															onClick={() => setExpiresIn(value)}
															className={cn(
																'flex-1 rounded-lg border py-1.5 text-xs transition-colors',
																expiresIn === value
																	? 'border-[#57FCFF]/40 bg-[#57FCFF]/10 text-[#57FCFF]'
																	: 'border-border bg-sidebar text-muted-foreground'
															)}
														>
															{value === null ? 'Never' : `${value} days`}
														</button>
													))}
												</div>
											</div>
										</div>

										<div className="space-y-3 rounded-2xl border border-border/50 bg-sidebar/20 p-4">
											<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
												Public Page Display
											</Label>
											<Field
												orientation="horizontal"
												className="items-start justify-between gap-4 rounded-xl border border-border/40 bg-sidebar/30 px-3 py-2.5"
											>
												<FieldContent className="gap-0.5">
													<FieldLabel
														htmlFor="share-show-timestamps"
														className="w-auto text-xs font-medium text-foreground"
													>
														Show timestamps
													</FieldLabel>
													<FieldDescription className="text-[11px] text-muted-foreground">
														Display message dates on the shared page.
													</FieldDescription>
												</FieldContent>
												<Switch
													id="share-show-timestamps"
													checked={showTimestamps}
													onCheckedChange={setShowTimestamps}
													className={displaySwitchClassName}
												/>
											</Field>
											<Field
												orientation="horizontal"
												className="items-start justify-between gap-4 rounded-xl border border-border/40 bg-sidebar/30 px-3 py-2.5"
											>
												<FieldContent className="gap-0.5">
													<FieldLabel
														htmlFor="share-show-model"
														className="w-auto text-xs font-medium text-foreground"
													>
														Show AI model name
													</FieldLabel>
													<FieldDescription className="text-[11px] text-muted-foreground">
														Expose which assistant model produced each reply.
													</FieldDescription>
												</FieldContent>
												<Switch
													id="share-show-model"
													checked={showModel}
													onCheckedChange={setShowModel}
													className={displaySwitchClassName}
												/>
											</Field>
											<Field
												orientation="horizontal"
												className="items-start justify-between gap-4 rounded-xl border border-border/40 bg-sidebar/30 px-3 py-2.5"
											>
												<FieldContent className="gap-0.5">
													<FieldLabel
														htmlFor="share-allow-download"
														className="w-auto text-xs font-medium text-foreground"
													>
														Allow Markdown download
													</FieldLabel>
													<FieldDescription className="text-[11px] text-muted-foreground">
														Let viewers export the published share as Markdown.
													</FieldDescription>
												</FieldContent>
												<Switch
													id="share-allow-download"
													checked={allowDownload}
													onCheckedChange={setAllowDownload}
													className={displaySwitchClassName}
												/>
											</Field>
										</div>
									</div>

									<div className="rounded-xl border border-border/50 bg-sidebar/30 p-3">
										<p className="text-xs text-muted-foreground">
											<span className="font-semibold text-foreground">Privacy:</span> only the{' '}
											{draftMessages.length || orderedSelectedMessages.length} selected message
											{(draftMessages.length || orderedSelectedMessages.length) !== 1 ? 's' : ''}{' '}
											will be shared. Sensitive values stay local until you publish, and the
											preview is never persisted.
										</p>
									</div>
								</div>
							</div>
						</div>
					) : (
						<div className="space-y-6 py-2">
							<div className="flex items-center gap-3 rounded-xl border border-[#57FCFF]/20 bg-[#57FCFF]/5 p-4">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#57FCFF]/15">
									<Check className="h-4 w-4 text-[#57FCFF]" />
								</div>
								<div>
									<p className="text-sm font-semibold text-foreground">Share link created</p>
									<p className="text-xs text-muted-foreground">
										Anyone with the link can view this shared conversation.
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Share Link
								</Label>
								<div className="flex gap-2">
									<Input
										value={shareUrl ?? ''}
										readOnly
										className="bg-sidebar font-mono text-sm text-foreground/80"
									/>
									<Button size="icon" variant="outline" onClick={handleCopy}>
										{copied ? (
											<Check className="h-4 w-4 text-[#57FCFF]" />
										) : (
											<Copy className="h-4 w-4 text-muted-foreground" />
										)}
									</Button>
								</div>
							</div>

							<div className="space-y-2">
								<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Share Via
								</Label>
								<div className="grid gap-3 sm:grid-cols-3">
									<Button
										variant="outline"
										className="bg-sidebar/50"
										onClick={() => handleShareVia('twitter')}
									>
										<Twitter className="mr-2 h-4 w-4" />
										X / Twitter
									</Button>
									<Button
										variant="outline"
										className="bg-sidebar/50"
										onClick={() => handleShareVia('linkedin')}
									>
										<Linkedin className="mr-2 h-4 w-4" />
										LinkedIn
									</Button>
									<Button
										variant="outline"
										className="bg-sidebar/50"
										onClick={() => handleShareVia('email')}
									>
										<Mail className="mr-2 h-4 w-4" />
										Email
									</Button>
								</div>
							</div>

							<div className="flex justify-end">
								<Button asChild variant="link" size="sm" className="px-0 text-[#57FCFF]">
									<Link href="/chat/shares">Manage shares</Link>
								</Button>
							</div>

							<div className="border-t border-border/50 pt-4">
								<Button
									variant="ghost"
									size="sm"
									onClick={handleRevoke}
									disabled={isRevoking}
									className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
								>
									{isRevoking ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<X className="mr-2 h-4 w-4" />
									)}
									Revoke this link
								</Button>
							</div>
						</div>
					)}
				</div>

				<div className="flex items-center justify-between gap-3 border-t border-border/50 px-6 py-4">
					<Button variant="ghost" size="sm" onClick={handleClose}>
						{step === 'done' ? 'Close' : 'Cancel'}
					</Button>
					{step === 'review' && (
						<Button
							onClick={handlePublish}
							disabled={isPreparing || isPublishing || draftMessages.length === 0}
							className="bg-[#57FCFF] font-semibold text-black hover:bg-[#57FCFF]/90"
						>
							{isPublishing ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Publishing…
								</>
							) : (
								<>
									<Link2 className="mr-2 h-4 w-4" />
									Publish Share Link
								</>
							)}
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

function shouldCollapsePreview(content: string): boolean {
	const normalizedContent = content.trim()
	if (!normalizedContent) return false

	const lineCount = normalizedContent.split(/\r?\n/).length
	return (
		normalizedContent.length > PREVIEW_COLLAPSE_MAX_CHARACTERS ||
		lineCount > PREVIEW_COLLAPSE_MAX_LINES
	)
}

function ToggleChip({
	label,
	active,
	onClick,
	icon,
}: {
	label: string
	active: boolean
	onClick: () => void
	icon?: ReactNode
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
				active
					? 'border-[#57FCFF]/40 bg-[#57FCFF]/10 text-[#57FCFF]'
					: 'border-border bg-sidebar text-muted-foreground'
			)}
		>
			{icon}
			{label}
		</button>
	)
}

function usePairAnalysis(
	selectedMessageIds: string[],
	allMessages: Message[]
): PairWarning[] {
	const selectedSet = useMemo(() => new Set(selectedMessageIds), [selectedMessageIds])
	const messageMap = useMemo(
		() => new Map(allMessages.map((message) => [message.id, message])),
		[allMessages]
	)

	const warnings = useMemo<PairWarning[]>(() => {
		const result: PairWarning[] = []
		for (const id of selectedSet) {
			const message = messageMap.get(id)
			if (!message) continue

			if (message.role === 'user') {
				const assistantChild = allMessages.find(
					(item) =>
						item.parentMessageId === message.id &&
						item.role === 'assistant' &&
						selectedSet.has(item.id)
				)
				if (!assistantChild) {
					const anyChild = allMessages.find(
						(item) => item.parentMessageId === message.id && item.role === 'assistant'
					)
					result.push({
						messageId: id,
						missingRole: 'assistant',
						partnerId: anyChild?.id,
					})
				}
			} else if (message.role === 'assistant') {
				if (message.parentMessageId && !selectedSet.has(message.parentMessageId)) {
					result.push({
						messageId: id,
						missingRole: 'user',
						partnerId: message.parentMessageId,
					})
				}
			}
		}
		return result
	}, [allMessages, messageMap, selectedSet])

	return warnings
}
