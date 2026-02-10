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
import { useCallback, useState } from 'react'

interface ChatTOCProps {
	messages: Message[]
	onScrollToMessage: (messageId: string) => void
	selectedMessageIds: Set<string>
	onToggleSelection: (messageId: string) => void
	onSelectAll: () => void
	onDeselectAll: () => void
	activeMessageId: string | null
	onShare?: (messageIds: string[]) => void
}

export function ChatTOC({
	messages,
	onScrollToMessage,
	selectedMessageIds,
	onToggleSelection,
	onSelectAll,
	onDeselectAll,
	activeMessageId,
	onShare,
}: ChatTOCProps) {
	const [isExpanded, setIsExpanded] = useState(false)
	const [isMobileOpen, setIsMobileOpen] = useState(false)

	// Filter to only user and assistant messages (exclude system)
	const visibleMessages = messages.filter(
		(m) => m.role === 'user' || m.role === 'assistant'
	)

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
	}, [allSelected, onSelectAll, onDeselectAll])

	const handleShare = useCallback(() => {
		if (onShare && selectedMessageIds.size > 0) {
			onShare(Array.from(selectedMessageIds))
		}
	}, [onShare, selectedMessageIds])

	// Strip markdown and formatting to get plain text
	const stripFormatting = (text: string) => {
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

	// Truncate text for preview
	const truncateText = (text: string, maxLength: number = 35) => {
		const cleaned = stripFormatting(text)
		if (cleaned.length <= maxLength) return cleaned
		return cleaned.slice(0, maxLength) + '...'
	}

	// Get full preview for tooltip (first 250 chars)
	const getFullPreview = (text: string) => {
		const cleaned = stripFormatting(text)
		if (cleaned.length <= 250) return cleaned
		return cleaned.slice(0, 250) + '...'
	}

	// Calculate line width based on message length (12px to 24px range)
	const getLineWidth = (text: string) => {
		const cleaned = stripFormatting(text)
		const length = cleaned.length
		// Short messages (< 30 chars): 12-16px
		// Medium messages (30-100 chars): 16-20px
		// Long messages (> 100 chars): 20-24px
		if (length < 30) return 'w-3' // 12px
		if (length < 60) return 'w-3.5' // 14px
		if (length < 100) return 'w-4' // 16px
		if (length < 200) return 'w-5' // 20px
		return 'w-6' // 24px
	}

	if (visibleMessages.length === 0) return null

	// Shared TOC content for both desktop and mobile
	const TOCContent = ({ isMobile = false }: { isMobile?: boolean }) => (
		<motion.div
			className={cn('flex flex-col h-full w-full', isMobile ? 'p-0' : '')}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			{/* Header with Select All */}
			<div
				className={cn(
					'flex items-center gap-2.5 px-4 py-3 border-b border-border/10 backdrop-blur-sm shrink-0',
					isMobile ? 'bg-background' : ''
				)}
			>
				<Checkbox
					checked={allSelected}
					onCheckedChange={handleSelectAllToggle}
					className="h-3.5 w-3.5 border-white/20 data-[state=checked]:bg-[#57FCFF] data-[state=checked]:text-black"
				/>
				<span className="text-[10px] font-semibold text-muted-foreground/90 flex-1 uppercase tracking-wider">
					{allSelected ? 'Deselect' : 'Select all'}
				</span>
				{someSelected && (
					<button
						onClick={handleShare}
						className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-[#57FCFF] bg-[#57FCFF]/10 hover:bg-[#57FCFF]/20 rounded transition-all hover:scale-105"
					>
						<Share2 className="w-3 h-3" />
						<span>{selectedMessageIds.size}</span>
					</button>
				)}
			</div>

			{/* Messages list */}
			<div className="flex-1 overflow-hidden">
				<ScrollArea className="h-full max-h-[45vh]">
					<div className="py-2 flex flex-col">
						{visibleMessages.map((message, index) => {
							const isUser = message.role === 'user'
							const isActive = activeMessageId === message.id
							const isSelected = selectedMessageIds.has(message.id)

							return (
								<TooltipProvider key={message.id} delayDuration={400}>
									<Tooltip>
										<TooltipTrigger asChild>
											<div
												className={cn(
													'flex items-center gap-3 px-4 py-2 cursor-pointer group',
													'transition-all duration-200',
													'hover:bg-white/5',
													isActive &&
														'bg-white/[0.03] border-l-2 border-[#57FCFF] pl-[14px]', // Compensate padding for border
													!isActive && 'border-l-2 border-transparent',
													!isUser && 'pl-7' // Indent assistant messages
												)}
											>
												<Checkbox
													checked={isSelected}
													onCheckedChange={() => onToggleSelection(message.id)}
													onClick={(e) => e.stopPropagation()}
													className={cn(
														'h-3 w-3 shrink-0 rounded-sm border-white/20 transition-opacity',
														'data-[state=checked]:bg-[#57FCFF] data-[state=checked]:text-black',
														isSelected || isActive
															? 'opacity-100'
															: 'opacity-0 group-hover:opacity-100' // Hide checkbox unless selected, active or hovered
													)}
												/>
												<div
													className="flex items-start gap-2.5 flex-1 min-w-0"
													onClick={() => {
														onScrollToMessage(message.id)
														if (isMobile) setIsMobileOpen(false)
													}}
												>
													{isUser ? (
														<User className="w-3.5 h-3.5 text-[#57FCFF] shrink-0 mt-0.5" />
													) : (
														<Bot className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
													)}
													<div className="flex flex-col gap-0.5 flex-1 min-w-0">
														<span
															className={cn(
																'text-[11px] leading-relaxed truncate',
																isUser
																	? 'text-foreground/90 font-medium'
																	: 'text-muted-foreground/70',
																isActive && 'text-[#57FCFF]'
															)}
														>
															{truncateText(message.content, 30)}
														</span>
													</div>
												</div>
											</div>
										</TooltipTrigger>
										<TooltipContent
											side="left"
											className="max-w-[280px] text-xs backdrop-blur-xl bg-[#0C1110]/95 border-white/10 text-white/90 shadow-2xl"
											sideOffset={10}
										>
											<p className="font-semibold mb-1.5 text-[#57FCFF] text-[10px] uppercase tracking-wider">
												{isUser ? 'You' : message.model || 'Assistant'}
											</p>
											<p className="leading-relaxed opacity-80">
												{getFullPreview(message.content)}
											</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)
						})}
					</div>
				</ScrollArea>
			</div>
		</motion.div>
	)

	// Line indicators for collapsed state
	const LineIndicators = () => (
		<motion.div
			className="flex flex-col gap-1.5 py-4 px-3 items-end w-full"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			{visibleMessages.map((message) => {
				const isUser = message.role === 'user'
				const isActive = activeMessageId === message.id
				const lineWidth = getLineWidth(message.content)

				return (
					<motion.button
						key={message.id}
						layoutId={`line-${message.id}`}
						onClick={() => onScrollToMessage(message.id)}
						className={cn(
							'h-[3px] rounded-full relative group transition-colors',
							lineWidth,
							isActive
								? isUser
									? 'bg-[#57FCFF] shadow-[0_0_8px_rgba(87,252,255,0.6)]'
									: 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]'
								: isUser
									? 'bg-[#57FCFF]/40 hover:bg-[#57FCFF]/80'
									: 'bg-white/20 hover:bg-white/50'
						)}
					/>
				)
			})}
		</motion.div>
	)

	return (
		<>
			{/* Desktop: Compact smooth expanding TOC */}
			<motion.div
				onMouseEnter={() => setIsExpanded(true)}
				onMouseLeave={() => setIsExpanded(false)}
				className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-30 flex-col items-end"
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
						'w-full rounded-2xl overflow-hidden backdrop-blur-xl border transition-colors duration-300',
						isExpanded
							? 'bg-[#0A0F0F]/90 border-white/10 shadow-2xl shadow-black/50'
							: 'bg-transparent border-transparent'
					)}
					layout
				>
					<AnimatePresence mode="wait">
						{isExpanded ? (
							<TOCContent key="expanded" />
						) : (
							<LineIndicators key="collapsed" />
						)}
					</AnimatePresence>
				</motion.div>
			</motion.div>

			{/* Mobile: Sheet trigger button */}
			<div className="md:hidden fixed bottom-24 right-4 z-30">
				<Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
					<SheetTrigger asChild>
						<button
							className={cn(
								'flex items-center justify-center w-11 h-11 rounded-full',
								'bg-[#0C1110]/90 backdrop-blur-md border border-white/10',
								'shadow-lg hover:bg-black hover:scale-105 relative',
								'transition-all duration-300 ease-out',
								'active:scale-95'
							)}
						>
							<List className="w-5 h-5 text-white/90" />
							{someSelected && (
								<span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#57FCFF] text-[10px] font-bold text-black flex items-center justify-center shadow-md">
									{selectedMessageIds.size}
								</span>
							)}
						</button>
					</SheetTrigger>
					<SheetContent
						side="right"
						className="w-[300px] p-0 border-l border-white/10 bg-[#0C1110]"
					>
						<SheetHeader className="p-5 pb-2 border-b border-white/10">
							<SheetTitle className="text-sm font-bold tracking-wide uppercase text-white/80">
								Contents
							</SheetTitle>
						</SheetHeader>
						<TOCContent isMobile />
					</SheetContent>
				</Sheet>
			</div>
		</>
	)
}
