'use client'

import { CollectionsModal } from '@/components/chat/collections-modal'
import { PlaceholderModal } from '@/components/chat/placeholder-modal'
import { SearchModal } from '@/components/chat/search-modal'
import { SettingsModal } from '@/components/chat/settings-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useConversations } from '@/hooks/use-conversations'
import { useSettings } from '@/hooks/use-settings'
import {
	Folder,
	GitBranch,
	History,
	Loader2,
	PanelLeftClose,
	PanelLeftOpen,
	Plus,
	Search,
	Settings,
	Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const navItems = [{ id: 'new-chat', label: 'New Chat', icon: Plus }]

const featureItems = [
	{ id: 'history', label: 'History', icon: History },
	{ id: 'folder', label: 'Collections', icon: Folder },
	{ id: 'branch', label: 'Branches', icon: GitBranch },
]

export function Sidebar() {
	const [activeItem, setActiveItem] = useState<string | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [collectionsOpen, setCollectionsOpen] = useState(false)
	const [branchesOpen, setBranchesOpen] = useState(false)
	const { settings, updateSettings, isLoaded } = useSettings()
	const [compactMode, setCompactMode] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const [generatingTitles, setGeneratingTitles] = useState<Set<string>>(
		new Set()
	)

	// Fetch real conversations from API
	const {
		conversations,
		isLoading: conversationsLoading,
		deleteConversation,
		isDeleting,
		invalidateConversations,
	} = useConversations({ limit: 10 })

	// Initialize compact mode from settings or screen size
	useEffect(() => {
		if (!isLoaded) return

		const isMobile = window.innerWidth < 768
		const initialCompact = settings.compactMode || isMobile
		setCompactMode(initialCompact)
	}, [isLoaded, settings.compactMode])

	// Listen for global settings shortcut
	useEffect(() => {
		const handleOpenSettings = () => {
			setSettingsOpen(true)
		}

		window.addEventListener('openSettings', handleOpenSettings as EventListener)
		return () =>
			window.removeEventListener(
				'openSettings',
				handleOpenSettings as EventListener
			)
	}, [])

	// Listen for global search shortcut (Ctrl/Cmd + K)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setSearchOpen(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Listen for chatChanged events to refresh the list
	useEffect(() => {
		const handleChatChanged = () => {
			invalidateConversations()
		}

		window.addEventListener('chatChanged', handleChatChanged)
		return () => window.removeEventListener('chatChanged', handleChatChanged)
	}, [invalidateConversations])

	// Listen for title generation events
	useEffect(() => {
		const handleTitleGenerating = (
			e: CustomEvent<{ conversationId: string }>
		) => {
			setGeneratingTitles((prev) => new Set(prev).add(e.detail.conversationId))
		}

		const handleTitleGenerated = (
			e: CustomEvent<{ conversationId: string }>
		) => {
			setGeneratingTitles((prev) => {
				const next = new Set(prev)
				next.delete(e.detail.conversationId)
				return next
			})
			invalidateConversations()
		}

		window.addEventListener(
			'titleGenerating',
			handleTitleGenerating as EventListener
		)
		window.addEventListener(
			'titleGenerated',
			handleTitleGenerated as EventListener
		)
		return () => {
			window.removeEventListener(
				'titleGenerating',
				handleTitleGenerating as EventListener
			)
			window.removeEventListener(
				'titleGenerated',
				handleTitleGenerated as EventListener
			)
		}
	}, [invalidateConversations])

	const handleChatClick = useCallback((conversationId: string) => {
		// Update URL and dispatch event
		window.history.replaceState({}, '', `/chat?c=${conversationId}`)
		window.dispatchEvent(
			new CustomEvent('chatChanged', {
				detail: { conversationId },
			})
		)
		setActiveItem(conversationId)
	}, [])

	const handleNewChat = useCallback(() => {
		setActiveItem('new-chat')
		window.history.replaceState({}, '', '/chat')
		window.dispatchEvent(
			new CustomEvent('chatChanged', {
				detail: { newChat: true },
			})
		)
	}, [])

	const handleDeleteConversation = useCallback(
		async (e: React.MouseEvent, conversationId: string) => {
			e.stopPropagation()
			if (isDeleting) return

			try {
				await deleteConversation(conversationId)
				// If we deleted the active conversation, clear it
				if (activeItem === conversationId) {
					handleNewChat()
				}
			} catch (error) {
				console.error('Failed to delete conversation:', error)
			}
		},
		[deleteConversation, isDeleting, activeItem, handleNewChat]
	)

	const toggleCompactMode = () => {
		const newCompact = !compactMode
		setCompactMode(newCompact)
		updateSettings({ compactMode: newCompact })
	}

	const handleFeatureClick = (itemId: string) => {
		setActiveItem(itemId)
		if (itemId === 'history') setHistoryOpen(true)
		else if (itemId === 'folder') setCollectionsOpen(true)
		else if (itemId === 'branch') setBranchesOpen(true)
	}

	// Format timestamp for display
	const formatTimestamp = (dateString: string) => {
		const date = new Date(dateString)
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
		const diffDays = Math.floor(diffHours / 24)

		if (diffHours < 1) return 'Just now'
		if (diffHours < 24) return `${diffHours}h ago`
		if (diffDays < 7) return `${diffDays}d ago`
		return date.toLocaleDateString()
	}

	return (
		<>
			<aside
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				className={`h-full flex flex-col bg-sidebar transition-all duration-300 ${
					compactMode && !isHovered ? 'w-[4rem]' : 'w-[280px]'
				}`}
			>
				{/* Editorial Logo - Typography based */}
				<div
					className={`${compactMode && !isHovered ? 'px-3 pt-12 pb-10' : 'px-6 pt-12 pb-10 flex items-start justify-between'} transition-all duration-300`}
				>
					{compactMode && !isHovered ? (
						<div className="cursor-default" title="Fork.AI">
							<h1 className="text-foreground font-serif text-xl tracking-tight leading-none">
								F
							</h1>
						</div>
					) : (
						<>
							<h1 className="text-foreground font-serif text-2xl tracking-tight leading-none">
								Fork
								<span className="text-muted-foreground font-serif italic">
									.AI
								</span>
							</h1>
							<button
								onClick={toggleCompactMode}
								className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30 rounded-md transition-all"
								title={
									compactMode
										? 'Keep expanded'
										: 'Collapse sidebar (hover to peek)'
								}
							>
								{compactMode ? (
									<PanelLeftOpen className="w-4 h-4" />
								) : (
									<PanelLeftClose className="w-4 h-4" />
								)}
							</button>
						</>
					)}
				</div>

				{/* Search Button */}
				<div
					className={`${compactMode && !isHovered ? 'px-2' : 'px-4'} pb-4 transition-all duration-300`}
				>
					<button
						onClick={() => setSearchOpen(true)}
						className={`flex items-center ${compactMode && !isHovered ? 'justify-center' : 'gap-3'} w-full ${compactMode && !isHovered ? 'p-2' : 'px-3 py-2'} text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30 rounded-md transition-all`}
						title="Search conversations"
					>
						<Search className="w-4 h-4" />
						{(!compactMode || isHovered) && <span>Search</span>}
					</button>
				</div>

				{/* Main Actions */}
				<div
					className={`${compactMode && !isHovered ? 'px-2' : 'px-4'} pb-8 space-y-1 transition-all duration-300`}
				>
					<button
						onClick={handleNewChat}
						className={`flex items-center ${compactMode && !isHovered ? 'justify-center' : 'gap-3'} w-full ${compactMode && !isHovered ? 'p-2.5' : 'px-3 py-2.5'} text-sm font-medium text-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent rounded-md transition-all group border border-transparent hover:border-border`}
						title={compactMode && !isHovered ? 'New Discussion' : undefined}
					>
						<div className="p-1 rounded bg-background border border-border group-hover:border-foreground/20 transition-colors">
							<Plus className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
						</div>
						{(!compactMode || isHovered) && <span>New Discussion</span>}
					</button>
				</div>

				{/* Navigation Groups */}
				<div
					className={`${compactMode && !isHovered ? 'px-2' : 'px-4'} space-y-8 overflow-y-auto flex-1 transition-all duration-300`}
				>
					<div>
						{(!compactMode || isHovered) && (
							<h3 className="px-3 mb-3 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 font-sans">
								Library
							</h3>
						)}
						<div className="space-y-0.5">
							{featureItems.map((item) => (
								<button
									key={item.id}
									onClick={() => handleFeatureClick(item.id)}
									className={`flex items-center ${compactMode && !isHovered ? 'justify-center' : 'gap-3'} w-full ${compactMode && !isHovered ? 'p-2' : 'px-3 py-2'} text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-all group`}
									title={compactMode && !isHovered ? item.label : undefined}
								>
									<item.icon className="w-4 h-4 stroke-[1.5] text-muted-foreground/70 group-hover:text-primary transition-colors" />
									{(!compactMode || isHovered) && (
										<span className="opacity-100 transition-opacity duration-300">
											{item.label}
										</span>
									)}
								</button>
							))}
						</div>
					</div>

					{/* Recent Branches */}
					{(!compactMode || isHovered) && (
						<div className="relative">
							<h3 className="px-3 mb-3 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 font-sans">
								Recent
							</h3>

							{/* Vertical line motif for branches */}
							<div className="absolute left-[23px] top-[32px] bottom-0 w-[1px] bg-border/40" />

							<div className="space-y-1 relative">
								{conversationsLoading ? (
									<div className="flex items-center justify-center py-4">
										<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
									</div>
								) : conversations.length === 0 ? (
									<p className="px-3 py-4 text-sm text-muted-foreground/60 italic">
										No conversations yet
									</p>
								) : (
									conversations.map((conv) => (
										<button
											key={conv.id}
											onClick={() => handleChatClick(conv.id)}
											className={`flex items-start gap-3 w-full px-3 py-2 group text-left hover:bg-sidebar-accent/30 rounded-md transition-colors ${
												activeItem === conv.id ? 'bg-sidebar-accent/50' : ''
											}`}
										>
											<div className="relative z-10 flex-shrink-0 mt-0.5">
												<div
													className={`w-1.5 h-1.5 rounded-full transition-colors ${
														activeItem === conv.id
															? 'bg-primary'
															: 'bg-border group-hover:bg-foreground'
													}`}
												/>
											</div>
											<div className="min-w-0 flex-1">
												{generatingTitles.has(conv.id) ? (
													<Skeleton className="h-4 w-32 mb-1" />
												) : (
													<div className="text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors font-medium">
														{conv.title}
													</div>
												)}
												<div className="flex items-center gap-2 mt-0.5">
													<span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider">
														{conv.messageCount} msgs
													</span>
													<span className="text-[10px] text-muted-foreground/40">
														{formatTimestamp(conv.updatedAt)}
													</span>
												</div>
											</div>
											{/* Delete button */}
											<button
												onClick={(e) => handleDeleteConversation(e, conv.id)}
												className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
												title="Delete conversation"
											>
												<Trash2 className="w-3 h-3" />
											</button>
										</button>
									))
								)}
							</div>
						</div>
					)}
				</div>

				{/* Preferences */}
				<div
					className={`mt-auto ${compactMode && !isHovered ? 'px-2' : 'px-4'} pb-8 transition-all duration-300`}
				>
					<button
						onClick={() => setSettingsOpen(true)}
						className={`flex items-center ${compactMode && !isHovered ? 'justify-center' : 'gap-3'} w-full ${compactMode && !isHovered ? 'p-2' : 'px-3 py-2'} text-sm text-muted-foreground hover:text-foreground transition-colors`}
						title={compactMode && !isHovered ? 'Preferences' : undefined}
					>
						<Settings className="w-4 h-4" />
						{(!compactMode || isHovered) && <span>Preferences</span>}
					</button>
				</div>
			</aside>

			{/* Modals */}
			<SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
			<SettingsModal
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				compactMode={compactMode}
				onCompactModeChange={(compact) => {
					setCompactMode(compact)
					updateSettings({ compactMode: compact })
				}}
			/>
			<PlaceholderModal
				open={historyOpen}
				onOpenChange={setHistoryOpen}
				title="History"
				description="View your conversation history"
				icon={History}
			/>
			<CollectionsModal
				open={collectionsOpen}
				onOpenChange={setCollectionsOpen}
			/>
			<PlaceholderModal
				open={branchesOpen}
				onOpenChange={setBranchesOpen}
				title="Branches"
				description="View and manage conversation branches"
				icon={GitBranch}
			/>
		</>
	)
}
