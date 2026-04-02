'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Message } from '@/hooks/use-chat'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
    AlertTriangle,
    Bot,
    Check,
    Copy,
    Eye,
    EyeOff,
    Link2,
    Loader2,
    Mail,
    Share2,
    Twitter,
    User,
    X
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

// --- Types ---

interface SelectiveShareModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	conversationId: string
	conversationTitle: string
	selectedMessageIds: string[] // ordered from TOC selection
	allMessages: Message[]
}

interface PairWarning {
	messageId: string
	missingRole: 'user' | 'assistant'
	partnerId?: string // the ID of the missing partner, if we can find it
}

type ExpiresIn = 7 | 30 | null

// --- Step enum ---
type Step = 'preview' | 'done'

// --- Main Component ---

export function SelectiveShareModal({
	open,
	onOpenChange,
	conversationId,
	conversationTitle,
	selectedMessageIds,
	allMessages,
}: SelectiveShareModalProps) {
	const { toast } = useToast()
	const [step, setStep] = useState<Step>('preview')
	const [isGenerating, setIsGenerating] = useState(false)
	const [shareUrl, setShareUrl] = useState<string | null>(null)
	const [shareToken, setShareToken] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [isRevoking, setIsRevoking] = useState(false)

	// Privacy controls
	const [redactedIds, setRedactedIds] = useState<Set<string>>(new Set())

	// Link settings
	const [shareTitle, setShareTitle] = useState(conversationTitle)
	const [expiresIn, setExpiresIn] = useState<ExpiresIn>(null)
	const [allowDownload, setAllowDownload] = useState(false)
	const [showTimestamps, setShowTimestamps] = useState(true)
	const [showModel, setShowModel] = useState(true)

	// --- Derived: messages to preview (sorted by createdAt, filtered to selected) ---
	const previewMessages = useMemo(() => {
		const selectedSet = new Set(selectedMessageIds)
		return allMessages
			.filter((m) => selectedSet.has(m.id) && (m.role === 'user' || m.role === 'assistant'))
			.sort((a, b) => {
				const at = a.createdAt?.getTime() ?? 0
				const bt = b.createdAt?.getTime() ?? 0
				return at - bt
			})
	}, [selectedMessageIds, allMessages])

	// --- Pair completeness analysis ---
	const { warnings, autoCompletePairs } = usePairAnalysis(
		selectedMessageIds,
		allMessages
	)

	// --- Handlers ---

	const toggleRedact = useCallback((id: string) => {
		setRedactedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}, [])

	const handleGenerate = useCallback(async () => {
		if (!conversationId || previewMessages.length === 0) return
		setIsGenerating(true)
		try {
			const res = await fetch('/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId,
					selectedMessageIds: previewMessages.map((m) => m.id),
					redactedMessageIds: Array.from(redactedIds),
					title: shareTitle || conversationTitle,
					expiresIn,
					allowDownload,
					showTimestamps,
					showModel,
				}),
			})
			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error ?? 'Failed to create share link')
			}
			const data = await res.json()
			setShareUrl(data.shareUrl)
			setShareToken(data.shareToken)
			setStep('done')
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to create share link'
			toast({ title: 'Error', description: msg, variant: 'destructive' })
		} finally {
			setIsGenerating(false)
		}
	}, [
		conversationId,
		previewMessages,
		redactedIds,
		shareTitle,
		conversationTitle,
		expiresIn,
		allowDownload,
		showTimestamps,
		showModel,
		toast,
	])

	const handleCopy = useCallback(async () => {
		if (!shareUrl) return
		try {
			await navigator.clipboard.writeText(shareUrl)
			setCopied(true)
			toast({ title: 'Link copied!', description: 'Share link copied to clipboard.' })
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast({ title: 'Failed to copy', variant: 'destructive' })
		}
	}, [shareUrl, toast])

	const handleRevoke = useCallback(async () => {
		if (!shareToken) return
		setIsRevoking(true)
		try {
			const res = await fetch(`/api/share/${shareToken}`, { method: 'DELETE' })
			if (!res.ok) throw new Error()
			toast({ title: 'Link revoked', description: 'The share link is no longer active.' })
			// Reset to let user create a new one
			setShareUrl(null)
			setShareToken(null)
			setStep('preview')
		} catch {
			toast({ title: 'Failed to revoke', variant: 'destructive' })
		} finally {
			setIsRevoking(false)
		}
	}, [shareToken, toast])

	const handleShareVia = useCallback(
		(platform: 'twitter' | 'email') => {
			if (!shareUrl) return
			const text = `Check out this conversation: ${shareTitle}`
			const encodedUrl = encodeURIComponent(shareUrl)
			const encodedText = encodeURIComponent(text)
			if (platform === 'twitter') {
				window.open(
					`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
					'_blank',
					'noopener,noreferrer'
				)
			} else {
				window.location.href = `mailto:?subject=${encodedText}&body=${encodedUrl}`
			}
		},
		[shareUrl, shareTitle]
	)

	const handleClose = useCallback(() => {
		onOpenChange(false)
		// Reset state after animation
		setTimeout(() => {
			setStep('preview')
			setShareUrl(null)
			setShareToken(null)
			setCopied(false)
			setRedactedIds(new Set())
		}, 300)
	}, [onOpenChange])

	// --- Render ---

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-popover border border-primary/20 sm:max-w-2xl max-h-[90vh] flex flex-col">
				<DialogHeader className="shrink-0">
					<DialogTitle className="text-foreground flex items-center gap-2">
						<Share2 className="w-5 h-5 text-[#57FCFF]" />
						Share Selected Messages
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{step === 'preview'
							? `Sharing ${previewMessages.length} message${previewMessages.length !== 1 ? 's' : ''}. Toggle the eye icon to redact any message.`
							: 'Your share link is ready. Anyone with the link can view these messages.'}
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto min-h-0">
					{step === 'preview' ? (
						<PreviewStep
							previewMessages={previewMessages}
							redactedIds={redactedIds}
							onToggleRedact={toggleRedact}
							warnings={warnings}
							onAutoComplete={autoCompletePairs}
							shareTitle={shareTitle}
							onTitleChange={setShareTitle}
							expiresIn={expiresIn}
							onExpiresChange={setExpiresIn}
							allowDownload={allowDownload}
							onAllowDownloadChange={setAllowDownload}
							showTimestamps={showTimestamps}
							onShowTimestampsChange={setShowTimestamps}
							showModel={showModel}
							onShowModelChange={setShowModel}
						/>
					) : (
						<DoneStep
							shareUrl={shareUrl!}
							copied={copied}
							onCopy={handleCopy}
							onRevoke={handleRevoke}
							isRevoking={isRevoking}
							onShareVia={handleShareVia}
							shareTitle={shareTitle}
						/>
					)}
				</div>

				{/* Footer actions */}
				<div className="shrink-0 pt-4 border-t border-border/50 flex items-center justify-between gap-3">
					<Button variant="ghost" size="sm" onClick={handleClose}>
						{step === 'done' ? 'Close' : 'Cancel'}
					</Button>
					{step === 'preview' && (
						<Button
							onClick={handleGenerate}
							disabled={isGenerating || previewMessages.length === 0}
							className="bg-[#57FCFF] text-black hover:bg-[#57FCFF]/90 font-semibold"
						>
							{isGenerating ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Generating…
								</>
							) : (
								<>
									<Link2 className="w-4 h-4 mr-2" />
									Generate Share Link
								</>
							)}
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

// --- Preview Step ---

interface PreviewStepProps {
	previewMessages: Message[]
	redactedIds: Set<string>
	onToggleRedact: (id: string) => void
	warnings: PairWarning[]
	onAutoComplete: () => void
	shareTitle: string
	onTitleChange: (v: string) => void
	expiresIn: ExpiresIn
	onExpiresChange: (v: ExpiresIn) => void
	allowDownload: boolean
	onAllowDownloadChange: (v: boolean) => void
	showTimestamps: boolean
	onShowTimestampsChange: (v: boolean) => void
	showModel: boolean
	onShowModelChange: (v: boolean) => void
}

function PreviewStep({
	previewMessages,
	redactedIds,
	onToggleRedact,
	warnings,
	onAutoComplete,
	shareTitle,
	onTitleChange,
	expiresIn,
	onExpiresChange,
	allowDownload,
	onAllowDownloadChange,
	showTimestamps,
	onShowTimestampsChange,
	showModel,
	onShowModelChange,
}: PreviewStepProps) {
	return (
		<div className="py-4 space-y-6">
			{/* Pair warnings */}
			{warnings.length > 0 && (
				<div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
					<AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
					<div className="flex-1 min-w-0">
						<p className="text-xs text-yellow-500 font-medium">
							{warnings.length} message{warnings.length !== 1 ? 's are' : ' is'} missing their pair
						</p>
						<p className="text-xs text-yellow-500/70 mt-0.5">
							Sharing without the question or response may lack context.
						</p>
					</div>
					<Button
						size="sm"
						variant="outline"
						className="shrink-0 text-xs border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
						onClick={onAutoComplete}
					>
						Auto-complete
					</Button>
				</div>
			)}

			{/* Message preview with redact controls */}
			<div>
				<Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
					Preview ({previewMessages.length} messages)
				</Label>
				<div className="space-y-3 max-h-64 overflow-y-auto pr-1">
					{previewMessages.map((message) => {
						const isUser = message.role === 'user'
						const isRedacted = redactedIds.has(message.id)
						return (
							<div
								key={message.id}
								className={cn(
									'flex gap-3 items-start group',
									isUser ? 'flex-row-reverse' : ''
								)}
							>
								{/* Icon */}
								<div
									className={cn(
										'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1',
										isUser ? 'bg-[#57FCFF]/20' : 'bg-white/10'
									)}
								>
									{isUser ? (
										<User className="w-3 h-3 text-[#57FCFF]" />
									) : (
										<Bot className="w-3 h-3 text-white/50" />
									)}
								</div>

								{/* Bubble */}
								<div
									className={cn(
										'flex-1 min-w-0 rounded-xl px-3 py-2.5 relative border transition-all',
										isUser
											? 'bg-[#57FCFF]/8 border-[#57FCFF]/15 text-white'
											: 'bg-white/5 border-white/10 text-white/80',
										isRedacted && 'opacity-40'
									)}
								>
									{isRedacted ? (
										<p className="text-xs italic text-white/40">
											[Message redacted by author]
										</p>
									) : (
										<p className="text-xs leading-relaxed line-clamp-3">
											{message.content}
										</p>
									)}
									{/* Redact toggle */}
									<button
										onClick={() => onToggleRedact(message.id)}
										className={cn(
											'absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
											isRedacted
												? 'opacity-100 text-red-400 hover:text-red-300'
												: 'text-white/30 hover:text-white/60'
										)}
										title={isRedacted ? 'Show message' : 'Redact message'}
									>
										{isRedacted ? (
											<EyeOff className="w-3 h-3" />
										) : (
											<Eye className="w-3 h-3" />
										)}
									</button>
								</div>
							</div>
						)
					})}
				</div>
			</div>

			<div className="border-t border-border/50" />

			{/* Settings */}
			<div className="space-y-4">
				<Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
					Link Settings
				</Label>

				{/* Share title */}
				<div className="space-y-1.5">
					<Label className="text-xs text-muted-foreground">Share title</Label>
					<Input
						value={shareTitle}
						onChange={(e) => onTitleChange(e.target.value)}
						placeholder="Conversation title"
						className="h-8 text-sm bg-sidebar border-border"
					/>
				</div>

				{/* Expiry */}
				<div className="space-y-1.5">
					<Label className="text-xs text-muted-foreground">Link expiry</Label>
					<div className="flex gap-2">
						{([7, 30, null] as const).map((val) => (
							<button
								key={String(val)}
								onClick={() => onExpiresChange(val)}
								className={cn(
									'flex-1 py-1.5 text-xs rounded-lg border transition-all',
									expiresIn === val
										? 'bg-[#57FCFF]/15 border-[#57FCFF]/40 text-[#57FCFF]'
										: 'bg-sidebar border-border text-muted-foreground hover:border-[#57FCFF]/20'
								)}
							>
								{val === null ? 'Never' : `${val} days`}
							</button>
						))}
					</div>
				</div>

				{/* Toggles */}
				<div className="space-y-2">
					{[
						{
							label: 'Show timestamps',
							value: showTimestamps,
							onChange: onShowTimestampsChange,
						},
						{
							label: 'Show AI model name',
							value: showModel,
							onChange: onShowModelChange,
						},
						{
							label: 'Allow Markdown download',
							value: allowDownload,
							onChange: onAllowDownloadChange,
						},
					].map(({ label, value, onChange }) => (
						<div key={label} className="flex items-center justify-between">
							<span className="text-xs text-muted-foreground">{label}</span>
							<button
								onClick={() => onChange(!value)}
								className={cn(
									'relative w-9 h-5 rounded-full transition-colors border',
									value
										? 'bg-[#57FCFF]/20 border-[#57FCFF]/40'
										: 'bg-sidebar border-border'
								)}
							>
								<span
									className={cn(
										'absolute top-0.5 w-4 h-4 rounded-full transition-transform bg-white/80',
										value ? 'translate-x-4' : 'translate-x-0.5'
									)}
								/>
							</button>
						</div>
					))}
				</div>
			</div>

			{/* Privacy note */}
			<div className="bg-sidebar/30 border border-border/50 rounded-lg p-3">
				<p className="text-xs text-muted-foreground">
					<span className="font-semibold text-foreground">Privacy:</span> Only the{' '}
					{previewMessages.length} selected message{previewMessages.length !== 1 ? 's' : ''} will be
					shared. Your name, email, and other conversations are never included. Redacted
					messages show as "[Message redacted by author]".
				</p>
			</div>
		</div>
	)
}

// --- Done Step ---

function DoneStep({
	shareUrl,
	copied,
	onCopy,
	onRevoke,
	isRevoking,
	onShareVia,
	shareTitle,
}: {
	shareUrl: string
	copied: boolean
	onCopy: () => void
	onRevoke: () => void
	isRevoking: boolean
	onShareVia: (platform: 'twitter' | 'email') => void
	shareTitle: string
}) {
	return (
		<div className="py-4 space-y-6">
			{/* Success indicator */}
			<div className="flex items-center gap-3 p-4 rounded-xl bg-[#57FCFF]/5 border border-[#57FCFF]/20">
				<div className="w-8 h-8 rounded-full bg-[#57FCFF]/20 flex items-center justify-center shrink-0">
					<Check className="w-4 h-4 text-[#57FCFF]" />
				</div>
				<div>
					<p className="text-sm font-semibold text-foreground">Share link created</p>
					<p className="text-xs text-muted-foreground">Anyone with the link can view these messages</p>
				</div>
			</div>

			{/* Share URL */}
			<div className="space-y-2">
				<Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					Share Link
				</Label>
				<div className="flex gap-2">
					<Input
						value={shareUrl}
						readOnly
						className="bg-sidebar border-border text-sm font-mono text-foreground/80"
					/>
					<Button
						onClick={onCopy}
						size="icon"
						variant="outline"
						className="shrink-0 border-[#57FCFF]/30 hover:bg-[#57FCFF]/10"
					>
						{copied ? (
							<Check className="w-4 h-4 text-[#57FCFF]" />
						) : (
							<Copy className="w-4 h-4 text-muted-foreground" />
						)}
					</Button>
				</div>
			</div>

			{/* Share via */}
			<div className="space-y-2">
				<Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					Share Via
				</Label>
				<div className="flex gap-3">
					<Button
						onClick={() => onShareVia('twitter')}
						variant="outline"
						className="flex-1 bg-sidebar/50 border-border hover:border-[#57FCFF]/30"
					>
						<Twitter className="w-4 h-4 mr-2" />
						Twitter
					</Button>
					<Button
						onClick={() => onShareVia('email')}
						variant="outline"
						className="flex-1 bg-sidebar/50 border-border hover:border-[#57FCFF]/30"
					>
						<Mail className="w-4 h-4 mr-2" />
						Email
					</Button>
				</div>
			</div>

			{/* Danger zone */}
			<div className="border-t border-border/50 pt-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={onRevoke}
					disabled={isRevoking}
					className="text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full"
				>
					{isRevoking ? (
						<Loader2 className="w-4 h-4 mr-2 animate-spin" />
					) : (
						<X className="w-4 h-4 mr-2" />
					)}
					Revoke this link
				</Button>
			</div>
		</div>
	)
}

// --- Pair analysis hook ---

function usePairAnalysis(
	selectedMessageIds: string[],
	allMessages: Message[]
): {
	warnings: PairWarning[]
	autoCompletePairs: () => void
} {
	const [, forceUpdate] = useState(0)

	const selectedSet = useMemo(() => new Set(selectedMessageIds), [selectedMessageIds])
	const messageMap = useMemo(
		() => new Map(allMessages.map((m) => [m.id, m])),
		[allMessages]
	)

	const warnings = useMemo<PairWarning[]>(() => {
		const result: PairWarning[] = []
		for (const id of selectedSet) {
			const msg = messageMap.get(id)
			if (!msg) continue

			if (msg.role === 'user') {
				// Check if there's a selected assistant child
				const assistantChild = allMessages.find(
					(m) => m.parentMessageId === msg.id && m.role === 'assistant' && selectedSet.has(m.id)
				)
				if (!assistantChild) {
					const anyChild = allMessages.find(
						(m) => m.parentMessageId === msg.id && m.role === 'assistant'
					)
					result.push({ messageId: id, missingRole: 'assistant', partnerId: anyChild?.id })
				}
			} else if (msg.role === 'assistant') {
				// Check if parent user message is selected
				if (msg.parentMessageId && !selectedSet.has(msg.parentMessageId)) {
					result.push({
						messageId: id,
						missingRole: 'user',
						partnerId: msg.parentMessageId,
					})
				}
			}
		}
		return result
	}, [selectedSet, messageMap, allMessages])

	const autoCompletePairs = useCallback(() => {
		// Add missing partners to selectedMessageIds (via parent — this mutates external state
		// through the prop, so we need a ref/callback approach; here we show a toast guide)
		// Since selectedMessageIds is passed from parent, we emit an event or call a passed setter.
		// We use a CustomEvent as the simplest cross-component approach.
		const missingIds = warnings
			.map((w) => w.partnerId)
			.filter((id): id is string => !!id)
		if (missingIds.length > 0) {
			window.dispatchEvent(
				new CustomEvent('shareAutoComplete', { detail: { messageIds: missingIds } })
			)
		}
		forceUpdate((n) => n + 1)
	}, [warnings])

	return { warnings, autoCompletePairs }
}
