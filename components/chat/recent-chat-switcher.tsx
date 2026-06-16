'use client'

import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
	type ConversationPreview,
	useConversations,
} from '@/hooks/use-conversations'
import { useSettings } from '@/hooks/use-settings'
import {
	isEditableShortcutTarget,
	parseShortcut,
	releasedKeyConfirmsShortcut,
	shortcutLabelParts,
	shortcutMatchesEvent,
} from '@/lib/keyboard-shortcuts'
import {
	RECENT_CHAT_LRU_LIMIT,
	readRecentChatLru,
	recordRecentChatVisit,
} from '@/lib/recent-chat-lru'
import { cn } from '@/lib/utils'
import { History, MessageSquare } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

function formatRelativeTime(dateString: string) {
	const date = new Date(dateString)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return 'Just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`
	return date.toLocaleDateString()
}

function getOrderedConversations(
	conversations: ConversationPreview[],
	recentChatIds: string[]
) {
	const conversationById = new Map(
		conversations.map((conversation) => [conversation.id, conversation])
	)
	const orderedFromLru = recentChatIds
		.map((id) => conversationById.get(id))
		.filter((conversation): conversation is ConversationPreview =>
			Boolean(conversation)
		)
	const lruConversationIds = new Set(
		orderedFromLru.map((conversation) => conversation.id)
	)
	const fallbackConversations = conversations.filter(
		(conversation) => !lruConversationIds.has(conversation.id)
	)

	return [...orderedFromLru, ...fallbackConversations]
}

function getInitialSelectedIndex(
	conversations: ConversationPreview[],
	activeConversationId: string | null
) {
	if (conversations.length === 0) return 0
	if (!activeConversationId) return 0

	const nextChatIndex = conversations.findIndex(
		(conversation) => conversation.id !== activeConversationId
	)

	return nextChatIndex === -1 ? 0 : nextChatIndex
}

function hasOpenDialog() {
	return document.querySelector('[role="dialog"]') !== null
}

export function RecentChatSwitcher() {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const router = useRouter()
	const { settings } = useSettings()
	const shortcut = settings.recentChatSwitcherShortcut
	const activeConversationId = searchParams.get('c')
	const [recentChatIds, setRecentChatIds] = useState<string[]>([])
	const [open, setOpen] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(0)
	const { conversations, isError } = useConversations({
		limit: RECENT_CHAT_LRU_LIMIT,
		pinned: false,
		enabled: pathname === '/chat',
	})

	const orderedConversations = useMemo(
		() => getOrderedConversations(conversations, recentChatIds),
		[conversations, recentChatIds]
	)
	const selectedConversation = orderedConversations[selectedIndex] ?? null
	const shortcutParts = shortcutLabelParts(shortcut)
	const parsedShortcut = parseShortcut(shortcut)
	const canCycleBackwardWithShift = !parsedShortcut.shiftKey

	const close = useCallback(() => {
		setOpen(false)
		setSelectedIndex(0)
	}, [])

	const navigateToConversation = useCallback(
		(conversation: ConversationPreview | null) => {
			if (!conversation) {
				close()
				return
			}

			if (conversation.id === activeConversationId) {
				close()
				return
			}

			router.replace(`/chat?c=${conversation.id}`, { scroll: false })
			close()
		},
		[activeConversationId, close, router]
	)

	const navigateToSelected = useCallback(() => {
		navigateToConversation(selectedConversation)
	}, [navigateToConversation, selectedConversation])

	const cycleSelection = useCallback(
		(direction: 1 | -1) => {
			setSelectedIndex((currentIndex) => {
				if (orderedConversations.length === 0) return 0
				return (
					(currentIndex + direction + orderedConversations.length) %
					orderedConversations.length
				)
			})
		},
		[orderedConversations.length]
	)

	useEffect(() => {
		if (selectedIndex < orderedConversations.length) return
		setSelectedIndex(0)
	}, [orderedConversations.length, selectedIndex])

	useEffect(() => {
		if (pathname !== '/chat') {
			close()
		}
	}, [close, pathname])

	useEffect(() => {
		setRecentChatIds(readRecentChatLru())
	}, [])

	useEffect(() => {
		if (pathname !== '/chat' || !activeConversationId) {
			return
		}

		setRecentChatIds(recordRecentChatVisit(activeConversationId))
	}, [activeConversationId, pathname])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (pathname !== '/chat' || isError) return

			if (open) {
				if (event.key === 'Escape') {
					event.preventDefault()
					close()
					return
				}

				if (event.key === 'Enter') {
					event.preventDefault()
					navigateToSelected()
					return
				}

				if (event.key === 'ArrowDown') {
					event.preventDefault()
					cycleSelection(1)
					return
				}

				if (event.key === 'ArrowUp') {
					event.preventDefault()
					cycleSelection(-1)
					return
				}

				if (
					canCycleBackwardWithShift &&
					event.shiftKey &&
					shortcutMatchesEvent(event, shortcut, { ignoreShift: true })
				) {
					event.preventDefault()
					cycleSelection(-1)
					return
				}

				if (shortcutMatchesEvent(event, shortcut)) {
					event.preventDefault()
					cycleSelection(1)
				}
				return
			}

			if (isEditableShortcutTarget(event.target)) return
			if (hasOpenDialog()) return
			if (!shortcutMatchesEvent(event, shortcut)) return

			event.preventDefault()
			if (orderedConversations.length === 0) return
			setSelectedIndex(
				getInitialSelectedIndex(orderedConversations, activeConversationId)
			)
			setOpen(true)
		}

		const handleKeyUp = (event: KeyboardEvent) => {
			if (!open || !releasedKeyConfirmsShortcut(event.key, shortcut)) return
			event.preventDefault()
			navigateToSelected()
		}

		window.addEventListener('keydown', handleKeyDown)
		window.addEventListener('keyup', handleKeyUp)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('keyup', handleKeyUp)
		}
	}, [
		canCycleBackwardWithShift,
		close,
		cycleSelection,
		isError,
		navigateToSelected,
		open,
		activeConversationId,
		orderedConversations,
		pathname,
		shortcut,
	])

	if (!open || orderedConversations.length === 0 || !selectedConversation) {
		return null
	}

	return (
		<div
			role="dialog"
			aria-label="Recent chat switcher"
			className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/70 bg-popover/95 p-2 text-popover-foreground shadow-2xl backdrop-blur"
		>
			<div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
				<div className="flex items-center gap-2 text-sm font-medium">
					<History className="h-4 w-4 text-primary" />
					Recent chats
				</div>
				<KbdGroup>
					{shortcutParts.map((part) => (
						<Kbd key={part}>{part}</Kbd>
					))}
				</KbdGroup>
			</div>

			<div className="max-h-[19rem] overflow-hidden py-1">
				{orderedConversations.map((conversation, index) => {
					const isSelected = index === selectedIndex
					const isCurrent = conversation.id === activeConversationId
					return (
						<button
							type="button"
							key={conversation.id}
							data-selected={isSelected}
							onMouseEnter={() => setSelectedIndex(index)}
							onClick={() => navigateToConversation(conversation)}
							className={cn(
								'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
								isSelected
									? 'bg-primary/12 text-foreground'
									: 'text-muted-foreground hover:bg-primary/8 hover:text-foreground'
							)}
						>
							<div
								className={cn(
									'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
									isSelected
										? 'border-primary/40 bg-primary/15 text-primary'
										: 'border-border/60 bg-sidebar/40'
								)}
							>
								<MessageSquare className="h-4 w-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 items-center gap-2">
									<div className="truncate text-sm font-medium">
										{conversation.title}
									</div>
									{isCurrent ? (
										<span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
											Current
										</span>
									) : null}
								</div>
								<div className="mt-0.5 truncate text-xs text-muted-foreground">
									{conversation.lastMessage?.content || 'No messages yet'}
								</div>
							</div>
							<div className="shrink-0 text-right text-xs text-muted-foreground">
								<div>
									{index + 1}/{orderedConversations.length}
								</div>
								<div>{formatRelativeTime(conversation.updatedAt)}</div>
							</div>
						</button>
					)
				})}
			</div>
		</div>
	)
}
