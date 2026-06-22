'use client'

import { useChatUI } from '@/components/chat/chat-ui-provider'
import { SidebarConversationRow } from '@/components/chat/sidebar/sidebar-conversation-row'
import { SidebarConversationSection } from '@/components/chat/sidebar/sidebar-conversation-section'
import { SidebarDialogs } from '@/components/chat/sidebar/sidebar-dialogs'
import { useSidebarConversationActions } from '@/components/chat/sidebar/use-sidebar-conversation-actions'
import { useAuth } from '@/contexts/auth-context'
import { type Collection, useCollections } from '@/hooks/use-collections'
import {
	type ConversationPreview,
	useConversation,
	useConversations,
} from '@/hooks/use-conversations'
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
	Share2,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { ContextChatDraft } from './sidebar/use-sidebar-conversation-actions'

type LibraryModal = 'history' | 'collections' | 'branches'
type LibraryItemId = LibraryModal | 'shares'

const featureItems = [
	{ id: 'history', label: 'History', icon: History },
	{ id: 'collections', label: 'Collections', icon: Folder },
	{ id: 'branches', label: 'Branches', icon: GitBranch },
	{ id: 'shares', label: 'Shares', icon: Share2 },
] satisfies Array<{
	id: LibraryItemId
	label: string
	icon: typeof History
}>

function formatTimestamp(dateString: string) {
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

export function Sidebar() {
	const pathname = usePathname()
	const router = useRouter()
	const searchParams = useSearchParams()
	const { settingsOpen, setSettingsOpen, generatingTitleIds } = useChatUI()
	const [openLibraryModal, setOpenLibraryModal] = useState<LibraryModal | null>(
		null
	)
	const [searchOpen, setSearchOpen] = useState(false)
	const { settings, updateSettings, isLoaded } = useSettings()
	const { user } = useAuth()
	const currentConversationId = searchParams.get('c')
	const { data: collections } = useCollections({ enabled: !!user })
	const [compactMode, setCompactMode] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	const {
		conversations: pinnedConversations,
		isLoading: pinnedLoading,
	} = useConversations({ limit: 100, pinned: true, enabled: !!user })

	const {
		conversations: recentConversations,
		isLoading: recentLoading,
		deleteConversation,
		isDeleting,
		updateConversation,
		isUpdating,
	} = useConversations({ limit: 10, pinned: false, enabled: !!user })
	const { data: activeConversationDetail } = useConversation(
		currentConversationId
	)

	useEffect(() => {
		if (!isLoaded) return

		const isMobile = window.innerWidth < 768
		const initialCompact = settings.compactMode || isMobile
		setCompactMode(initialCompact)
	}, [isLoaded, settings.compactMode])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				setSearchOpen(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	const handleChatClick = useCallback(
		(conversationId: string) => {
			router.replace(`/chat?c=${conversationId}`, { scroll: false })
		},
		[router]
	)

	const handleNewChat = useCallback(() => {
		router.replace('/chat', { scroll: false })
	}, [router])

	const handleStartContextChat = useCallback(
		(draftId: string, draft: ContextChatDraft) => {
			if (typeof window !== 'undefined') {
				window.sessionStorage.setItem(
					`fork-context-chat:${draftId}`,
					JSON.stringify(draft)
				)
			}
			router.replace(`/chat?contextDraft=${encodeURIComponent(draftId)}`, {
				scroll: false,
			})
		},
		[router]
	)

	const {
		renameDialog,
		renameTitle,
		setRenameTitle,
		isRenameUnchanged,
		closeRenameDialog,
		handleSaveRename,
		shareDialog,
		setShareDialog,
		openConversationMenu,
		getConversationActions,
		handleConversationMenuOpenChange,
		handleAutoCompleteSharePairs,
	} = useSidebarConversationActions({
		activeConversationId: currentConversationId,
		collections: collections as Collection[] | undefined,
		deleteConversation,
		handleChatClick,
		handleNewChat,
		isDeleting,
		startContextChat: handleStartContextChat,
		updateConversation,
	})

	const toggleCompactMode = () => {
		const newCompact = !compactMode
		setCompactMode(newCompact)
		updateSettings({ compactMode: newCompact })
	}

	const handleLibraryItemClick = (itemId: LibraryItemId) => {
		if (itemId === 'shares') {
			setOpenLibraryModal(null)
			router.replace('/chat/shares', { scroll: false })
			return
		}

		setOpenLibraryModal(itemId)
	}

	const handleOpenForkView = useCallback(
		(conversationId: string) => {
			setOpenLibraryModal(null)
			router.replace(`/chat?c=${conversationId}&view=fork`, { scroll: false })
		},
		[router]
	)

	const renderConversationRow = (conversation: ConversationPreview) => (
		<SidebarConversationRow
			key={conversation.id}
			conversation={conversation}
			isActive={currentConversationId === conversation.id}
			isGeneratingTitle={generatingTitleIds.has(conversation.id)}
			menuActions={getConversationActions(conversation)}
			menuOpen={
				openConversationMenu?.id === conversation.id &&
				openConversationMenu.surface === 'dropdown'
			}
			onMenuOpenChange={handleConversationMenuOpenChange}
			onOpenConversation={handleChatClick}
			timestampLabel={formatTimestamp(conversation.updatedAt)}
		/>
	)

	const hasPinnedConversations = pinnedConversations.length > 0
	const hasRecentConversations = recentConversations.length > 0
	const activeConversation =
		[...pinnedConversations, ...recentConversations].find(
			(conversation) => conversation.id === currentConversationId
		) ?? null
	const activeConversationTitle =
		activeConversationDetail?.title ?? activeConversation?.title ?? null
	const showConversationLoader =
		(pinnedLoading || recentLoading) &&
		!hasPinnedConversations &&
		!hasRecentConversations
	const hasOpenConversationMenu = openConversationMenu !== null
	const isSidebarCollapsed =
		compactMode && !isHovered && !hasOpenConversationMenu
	const isSidebarExpanded = !isSidebarCollapsed
	const activeLibraryItem: LibraryItemId | null = pathname?.startsWith(
		'/chat/shares'
	)
		? 'shares'
		: openLibraryModal

	return (
		<>
			<aside
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				className={`flex h-full flex-col bg-sidebar transition-all duration-300 ${
					isSidebarCollapsed ? 'w-[4rem]' : 'w-[280px]'
				}`}
			>
				<div
					className={`transition-all duration-300 ${
						isSidebarCollapsed
							? 'px-3 pb-10 pt-12'
							: 'flex items-start justify-between px-6 pb-10 pt-12'
					}`}
				>
					{isSidebarCollapsed ? (
						<div className="cursor-default" title="Fork.AI">
							<h1 className="text-xl leading-none tracking-tight text-foreground font-serif">
								F
							</h1>
						</div>
					) : (
						<>
							<h1 className="text-2xl leading-none tracking-tight text-foreground font-serif">
								Fork
								<span className="font-serif italic text-muted-foreground">
									.AI
								</span>
							</h1>
							<button
								onClick={toggleCompactMode}
								className="rounded-md p-1.5 text-muted-foreground transition-all hover:bg-sidebar-accent/30 hover:text-foreground"
								title={
									compactMode
										? 'Keep expanded'
										: 'Collapse sidebar (hover to peek)'
								}
							>
								{compactMode ? (
									<PanelLeftOpen className="h-4 w-4" />
								) : (
									<PanelLeftClose className="h-4 w-4" />
								)}
							</button>
						</>
					)}
				</div>

				<div
					className={`pb-4 transition-all duration-300 ${
						isSidebarCollapsed ? 'px-2' : 'px-4'
					}`}
				>
					<button
						onClick={() => setSearchOpen(true)}
						className={`flex w-full items-center rounded-md text-sm text-muted-foreground transition-all hover:bg-sidebar-accent/30 hover:text-foreground ${
							isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
						}`}
						title="Search conversations"
					>
						<Search className="h-4 w-4" />
						{isSidebarExpanded ? <span>Search</span> : null}
					</button>
				</div>

				<div
					className={`space-y-1 pb-8 transition-all duration-300 ${
						isSidebarCollapsed ? 'px-2' : 'px-4'
					}`}
				>
					<button
						onClick={handleNewChat}
						className={`group flex w-full items-center rounded-md border border-transparent bg-sidebar-accent/50 text-sm font-medium text-foreground transition-all hover:border-border hover:bg-sidebar-accent ${
							isSidebarCollapsed
								? 'justify-center p-2.5'
								: 'gap-3 px-3 py-2.5'
						}`}
						title={isSidebarCollapsed ? 'New Discussion' : undefined}
					>
						<div className="rounded border border-border bg-background p-1 transition-colors group-hover:border-foreground/20">
							<Plus className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground" />
						</div>
						{isSidebarExpanded ? <span>New Discussion</span> : null}
					</button>
				</div>

				<div
					className={`flex-1 space-y-8 overflow-y-auto transition-all duration-300 ${
						isSidebarCollapsed ? 'px-2' : 'px-4'
					}`}
				>
					<div>
						{isSidebarExpanded ? (
							<h3 className="mb-3 px-3 font-sans text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
								Library
							</h3>
						) : null}
						<div className="space-y-0.5">
							{featureItems.map((item) => {
								const isActive = activeLibraryItem === item.id

								return (
									<button
										key={item.id}
										onClick={() => handleLibraryItemClick(item.id)}
										className={`group flex w-full items-center rounded-md text-sm transition-all ${
											isActive
												? 'bg-primary/10 text-primary'
												: 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
										} ${
											isSidebarCollapsed
												? 'justify-center p-2'
												: 'gap-3 px-3 py-2'
										}`}
										title={isSidebarCollapsed ? item.label : undefined}
										aria-current={
											isActive && item.id === 'shares' ? 'page' : undefined
										}
									>
										<item.icon
											className={`h-4 w-4 stroke-[1.5] transition-colors ${
												isActive
													? 'text-primary'
													: 'text-muted-foreground/70 group-hover:text-primary'
											}`}
										/>
										{isSidebarExpanded ? (
											<span className="opacity-100 transition-opacity duration-300">
												{item.label}
											</span>
										) : null}
									</button>
								)
							})}
						</div>
					</div>

					{isSidebarExpanded ? (
						showConversationLoader ? (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
							</div>
						) : (
							<>
								{hasPinnedConversations ? (
									<SidebarConversationSection
										title="Pinned"
										conversations={pinnedConversations}
										renderRow={renderConversationRow}
									/>
								) : null}

								<SidebarConversationSection
									title="Recent"
									conversations={recentConversations}
									renderRow={renderConversationRow}
									emptyState={
										!hasPinnedConversations ? (
											<p className="px-3 py-4 text-sm italic text-muted-foreground/60">
												No conversations yet
											</p>
										) : null
									}
								/>
							</>
						)
					) : null}
				</div>

				<div
					className={`mt-auto pb-8 transition-all duration-300 ${
						isSidebarCollapsed ? 'px-2' : 'px-4'
					}`}
				>
					<button
						onClick={() => setSettingsOpen(true)}
						className={`flex w-full items-center text-sm text-muted-foreground transition-colors hover:text-foreground ${
							isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
						}`}
						title={isSidebarCollapsed ? 'Preferences' : undefined}
					>
						<Settings className="h-4 w-4" />
						{isSidebarExpanded ? <span>Preferences</span> : null}
					</button>
				</div>
			</aside>

			<SidebarDialogs
				activeConversationId={currentConversationId}
				activeConversationTitle={activeConversationTitle}
				closeRenameDialog={closeRenameDialog}
				compactMode={compactMode}
				isRenameUnchanged={isRenameUnchanged}
				isUpdating={isUpdating}
				libraryModal={openLibraryModal}
				onLibraryModalChange={setOpenLibraryModal}
				renameDialog={renameDialog}
				renameTitle={renameTitle}
				searchOpen={searchOpen}
				setCompactMode={setCompactMode}
				setRenameTitle={setRenameTitle}
				setSearchOpen={setSearchOpen}
				setSettingsOpen={setSettingsOpen}
				setShareDialog={setShareDialog}
				settingsOpen={settingsOpen}
				shareDialog={shareDialog}
				onAutoCompletePairs={handleAutoCompleteSharePairs}
				onCompactModeChange={(compact) =>
					updateSettings({ compactMode: compact })
				}
				onOpenForkView={handleOpenForkView}
				onSaveRename={handleSaveRename}
			/>
		</>
	)
}
