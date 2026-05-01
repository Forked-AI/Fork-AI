'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Message } from '@/hooks/use-chat'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, List, Share2, User } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const TOC_COLLAPSE_DELAY_MS = 160
const TOC_PREVIEW_LENGTH = 30
const TOC_TOOLTIP_PREVIEW_LENGTH = 250

interface TocPreviewData {
	preview: string
	fullPreview: string
	lineWidthClassName: string
	timestampLabel: string | null
}

function stripFormatting(text: string) {
	return (
		text
			// Remove code blocks
			.replace(/```[\s\S]*?```/g, '[code]')
			.replace(/`([^`]+)`/g, '$1')
			// Remove headers
			.replace(/^#{1,6}\s+/gm, '')
			// Remove bold/italic
			.replace(/(\*\*|__)(.*?)\1/g, '$2')
			.replace(/(\*|_)(.*?)\1/g, '$2')
			// Remove links
			.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
			// Remove images
			.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
			// Remove blockquotes
			.replace(/^>\s+/gm, '')
			// Remove list markers
			.replace(/^[\s]*[-*+]\s+/gm, '')
			.replace(/^[\s]*\d+\.\s+/gm, '')
			// Remove extra whitespace and newlines
			.replace(/\n+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	)
}

function truncateCleanedText(text: string, maxLength: number) {
	if (text.length <= maxLength) return text
	return text.slice(0, maxLength) + '...'
}

function getLineWidthFromLength(length: number) {
	if (length < 30) return 'w-3' // 12px
	if (length < 60) return 'w-3.5' // 14px
	if (length < 100) return 'w-4' // 16px
	if (length < 200) return 'w-5' // 20px
	return 'w-6' // 24px
}

interface ChatTOCProps {
	messages: Message[]
	onScrollToMessage: (messageId: string) => void
	selectedMessageIds: Set<string>
	onToggleSelection: (messageId: string) => void
	onSelectAll: () => void
	onDeselectAll: () => void
	activeMessageId: string | null
	onShare?: (messageIds: string[]) => void
	isStreaming: boolean
}

export const ChatTOC = memo(function ChatTOC({
	messages,
	onScrollToMessage,
	selectedMessageIds,
	onToggleSelection,
	onSelectAll,
	onDeselectAll,
	activeMessageId,
	onShare,
	isStreaming,
}: ChatTOCProps) {
	const [isExpanded, setIsExpanded] = useState(false)
	const [isMobileOpen, setIsMobileOpen] = useState(false)
	const collapseTimeoutRef = useRef<number | null>(null)
	const desktopContainerRef = useRef<HTMLDivElement | null>(null)
	const stablePreviewMessagesRef = useRef<Message[]>(messages)

	const timestampFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(undefined, {
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			}),
		[]
	)

	const visibleMessages = useMemo(
		() => messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
		[messages]
	)

	useEffect(() => {
		if (!isStreaming) {
			stablePreviewMessagesRef.current = visibleMessages
		}
	}, [isStreaming, visibleMessages])

	const clearCollapseTimeout = useCallback(() => {
		if (collapseTimeoutRef.current !== null) {
			window.clearTimeout(collapseTimeoutRef.current)
			collapseTimeoutRef.current = null
		}
	}, [])

	const collapseDesktopToc = useCallback(() => {
		clearCollapseTimeout()
		setIsExpanded(false)
	}, [clearCollapseTimeout])

	const scheduleDesktopCollapse = useCallback(() => {
		clearCollapseTimeout()
		collapseTimeoutRef.current = window.setTimeout(() => {
			collapseTimeoutRef.current = null
			setIsExpanded(false)
		}, TOC_COLLAPSE_DELAY_MS)
	}, [clearCollapseTimeout])

	const handleDesktopPointerEnter = useCallback(() => {
		clearCollapseTimeout()
		setIsExpanded(true)
	}, [clearCollapseTimeout])

	const handleDesktopPointerLeave = useCallback(() => {
		scheduleDesktopCollapse()
	}, [scheduleDesktopCollapse])

	useEffect(() => {
		return () => {
			clearCollapseTimeout()
		}
	}, [clearCollapseTimeout])

	useEffect(() => {
		if (!isExpanded) return

		const handleVisibilityChange = () => {
			if (document.visibilityState !== 'visible') {
				collapseDesktopToc()
			}
		}

		const handleWindowPointerMove = () => {
			const desktopContainer = desktopContainerRef.current
			if (!desktopContainer) return
			if (desktopContainer.matches(':hover')) {
				clearCollapseTimeout()
				return
			}
			scheduleDesktopCollapse()
		}

		const handlePointerDown = (event: PointerEvent) => {
			const desktopContainer = desktopContainerRef.current
			if (!desktopContainer) return
			if (desktopContainer.contains(event.target as Node)) {
				clearCollapseTimeout()
				return
			}
			scheduleDesktopCollapse()
		}

		window.addEventListener('blur', collapseDesktopToc)
		document.addEventListener('visibilitychange', handleVisibilityChange)
		window.addEventListener('pointermove', handleWindowPointerMove, {
			passive: true,
		})
		document.addEventListener('pointerdown', handlePointerDown, true)

		return () => {
			window.removeEventListener('blur', collapseDesktopToc)
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			window.removeEventListener('pointermove', handleWindowPointerMove)
			document.removeEventListener('pointerdown', handlePointerDown, true)
		}
	}, [
		clearCollapseTimeout,
		collapseDesktopToc,
		isExpanded,
		scheduleDesktopCollapse,
	])

	const previewSourceMessages =
		isStreaming && stablePreviewMessagesRef.current.length > 0
			? stablePreviewMessagesRef.current
			: visibleMessages

	const previewDataByMessageId = useMemo(() => {
		const data = new Map<string, TocPreviewData>()

		for (const message of previewSourceMessages) {
			const cleaned = stripFormatting(message.content)
			data.set(message.id, {
				preview: truncateCleanedText(cleaned, TOC_PREVIEW_LENGTH),
				fullPreview: truncateCleanedText(cleaned, TOC_TOOLTIP_PREVIEW_LENGTH),
				lineWidthClassName: getLineWidthFromLength(cleaned.length),
				timestampLabel: message.createdAt
					? timestampFormatter.format(message.createdAt)
					: null,
			})
		}

		return data
	}, [previewSourceMessages, timestampFormatter])

	const resolvedPreviewDataByMessageId = useMemo(() => {
		if (!isStreaming) return previewDataByMessageId

		const mergedData = new Map(previewDataByMessageId)
		for (const message of visibleMessages) {
			if (mergedData.has(message.id)) continue

			const cleaned = stripFormatting(message.content)
			mergedData.set(message.id, {
				preview: truncateCleanedText(cleaned, TOC_PREVIEW_LENGTH),
				fullPreview: truncateCleanedText(cleaned, TOC_TOOLTIP_PREVIEW_LENGTH),
				lineWidthClassName: getLineWidthFromLength(cleaned.length),
				timestampLabel: message.createdAt
					? timestampFormatter.format(message.createdAt)
					: null,
			})
		}

		return mergedData
	}, [isStreaming, previewDataByMessageId, timestampFormatter, visibleMessages])

	const allSelected =
		visibleMessages.length > 0 &&
		visibleMessages.every((m) => selectedMessageIds.has(m.id))
	const someSelected = selectedMessageIds.size > 0

	const handleSelectAllToggle = useCallback(() => {
		if (allSelected) {
			onDeselectAll()
		} else {
			onSelectAll()
		}
	}, [allSelected, onDeselectAll, onSelectAll])

	const handleShare = useCallback(() => {
		if (onShare && selectedMessageIds.size > 0) {
			onShare(Array.from(selectedMessageIds))
		}
	}, [onShare, selectedMessageIds])

	if (visibleMessages.length === 0) return null

	const renderTOCContent = (isMobile = false) => (
		<motion.div
			key={isMobile ? 'expanded-mobile' : 'expanded'}
			className={cn('flex h-full w-full flex-col', isMobile ? 'p-0' : '')}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			<div
				className={cn(
					'flex shrink-0 items-center gap-2.5 border-b border-border/10 px-4 py-3',
					isMobile ? 'bg-background' : ''
				)}
			>
				<Checkbox
					checked={allSelected}
					onCheckedChange={handleSelectAllToggle}
					className="h-3.5 w-3.5"
				/>
				<span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
					{allSelected ? 'Deselect' : 'Select all'}
				</span>
				{someSelected ? (
					<button
						onClick={handleShare}
						className="flex items-center gap-1.5 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary transition-all hover:scale-105 hover:bg-primary/20"
					>
						<Share2 className="h-3 w-3" />
						<span>{selectedMessageIds.size}</span>
					</button>
				) : null}
			</div>

			<div className="flex-1 overflow-hidden">
				<ScrollArea className="h-full max-h-[45vh]">
					<div className="flex flex-col py-2">
						<TooltipProvider delayDuration={400}>
							{visibleMessages.map((message) => {
								const isUser = message.role === 'user'
								const isActive = activeMessageId === message.id
								const isSelected = selectedMessageIds.has(message.id)
								const previewData = resolvedPreviewDataByMessageId.get(message.id)
								const timestamp = previewData?.timestampLabel

								return (
									<Tooltip key={message.id}>
										<TooltipTrigger asChild>
											<div
												className={cn(
													'group flex cursor-pointer items-center gap-3 px-4 py-2',
													'transition-all duration-200',
													'hover:bg-accent/50',
													isActive &&
														'border-l-2 border-primary bg-accent/10 pl-[14px]',
													!isActive && 'border-l-2 border-transparent',
													!isUser && 'pl-7'
												)}
											>
												<Checkbox
													checked={isSelected}
													onCheckedChange={() => onToggleSelection(message.id)}
													onClick={(event) => event.stopPropagation()}
													className={cn(
														'h-3 w-3 shrink-0 border-border transition-opacity',
														'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
														isSelected || isActive
															? 'opacity-100'
															: 'opacity-0 group-hover:opacity-100'
													)}
												/>
												<div
													className="flex min-w-0 flex-1 items-start gap-2.5"
													onClick={() => {
														onScrollToMessage(message.id)
														if (isMobile) setIsMobileOpen(false)
													}}
												>
													{isUser ? (
														<User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
													) : (
														<Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
													)}
													<div className="flex min-w-0 flex-1 flex-col gap-0.5">
														<span
															className={cn(
																'truncate text-[11px] leading-relaxed',
																isUser
																	? 'font-medium text-foreground/90'
																	: 'text-muted-foreground/70',
																isActive && 'text-primary'
															)}
														>
															{previewData?.preview ?? ''}
														</span>
														{timestamp ? (
															<span className="text-[10px] text-muted-foreground/45">
																{timestamp}
															</span>
														) : null}
													</div>
												</div>
											</div>
										</TooltipTrigger>
										<TooltipContent
											side="left"
											sideOffset={10}
											className="pointer-events-none max-w-[280px] border-border bg-popover text-xs text-popover-foreground shadow-2xl"
										>
											<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
												{isUser ? 'You' : message.model || 'Assistant'}
											</p>
											<p className="leading-relaxed opacity-80">
												{previewData?.fullPreview ?? ''}
											</p>
										</TooltipContent>
									</Tooltip>
								)
							})}
						</TooltipProvider>
					</div>
				</ScrollArea>
			</div>
		</motion.div>
	)

	const renderLineIndicators = () => (
		<motion.div
			key="collapsed"
			className="flex w-full flex-col items-end gap-1.5 px-3 py-4"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			{visibleMessages.map((message) => {
				const isUser = message.role === 'user'
				const isActive = activeMessageId === message.id
				const lineWidth =
					resolvedPreviewDataByMessageId.get(message.id)?.lineWidthClassName ??
					'w-3'

				return (
					<motion.button
						key={message.id}
						layoutId={`line-${message.id}`}
						onClick={() => onScrollToMessage(message.id)}
						className={cn(
							'relative h-[3px] rounded-full transition-colors',
							lineWidth,
							isActive
								? isUser
									? 'bg-primary shadow-sm'
									: 'bg-foreground shadow-sm'
								: isUser
									? 'bg-primary/40 hover:bg-primary/80'
									: 'bg-foreground/20 hover:bg-foreground/50'
						)}
					/>
				)
			})}
		</motion.div>
	)

	return (
		<>
			<motion.div
				ref={desktopContainerRef}
				data-testid="chat-toc-desktop"
				onPointerEnter={handleDesktopPointerEnter}
				onPointerLeave={handleDesktopPointerLeave}
				className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end md:flex"
				initial={false}
				animate={{
					width: isExpanded ? 260 : 60,
				}}
				transition={{
					type: 'spring',
					stiffness: 400,
					damping: 30,
				}}
			>
				<motion.div
					className={cn(
						'w-full overflow-hidden rounded-2xl border transition-colors duration-300',
						isExpanded
							? 'border-border bg-popover shadow-2xl shadow-black/50'
							: 'border-transparent bg-transparent'
					)}
					layout
				>
					<AnimatePresence mode="wait">
						{isExpanded ? renderTOCContent() : renderLineIndicators()}
					</AnimatePresence>
				</motion.div>
			</motion.div>

			<div className="fixed bottom-24 right-4 z-30 md:hidden">
				<Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
					<SheetTrigger asChild>
						<button
							className={cn(
								'relative flex h-11 w-11 items-center justify-center rounded-full',
								'border border-border bg-popover',
								'shadow-lg transition-all duration-300 ease-out hover:scale-105 hover:bg-card',
								'active:scale-95'
							)}
						>
							<List className="h-5 w-5 text-foreground/90" />
							{someSelected ? (
								<span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-md">
									{selectedMessageIds.size}
								</span>
							) : null}
						</button>
					</SheetTrigger>
					<SheetContent
						side="right"
						className="w-[300px] border-l border-border bg-popover p-0"
					>
						<SheetHeader className="border-b border-border p-5 pb-2">
							<SheetTitle className="text-sm font-bold uppercase tracking-wide text-foreground/80">
								Contents
							</SheetTitle>
						</SheetHeader>
						{renderTOCContent(true)}
					</SheetContent>
				</Sheet>
			</div>
		</>
	)
})

ChatTOC.displayName = 'ChatTOC'
