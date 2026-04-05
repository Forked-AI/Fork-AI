'use client'

import { CollectionsModal } from '@/components/chat/collections-modal'
import { PlaceholderModal } from '@/components/chat/placeholder-modal'
import { SearchModal } from '@/components/chat/search-modal'
import { SelectiveShareModal } from '@/components/chat/selective-share-modal'
import { SettingsModal } from '@/components/chat/settings-modal'
import { Button } from '@/components/ui/button'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import { type Collection, useCollections } from '@/hooks/use-collections'
import { type Message } from '@/hooks/use-chat'
import {
	type ConversationPreview,
	useConversations,
} from '@/hooks/use-conversations'
import { useSettings } from '@/hooks/use-settings'
import { useToast } from '@/hooks/use-toast'
import { openConversation, openNewChat } from '@/lib/chat-navigation'
import {
	Edit2,
	Folder,
	FolderOpen,
	GitBranch,
	History,
	Loader2,
	MessageSquare,
	MoreVertical,
	PanelLeftClose,
	PanelLeftOpen,
	Pin,
	PinOff,
	Plus,
	Search,
	Settings,
	Share2,
	Trash2,
	type LucideIcon,
} from 'lucide-react'
import {
	useCallback,
	useEffect,
	useState,
	type CSSProperties,
	type ReactNode,
} from 'react'

const featureItems = [
	{ id: 'history', label: 'History', icon: History },
	{ id: 'folder', label: 'Collections', icon: Folder },
	{ id: 'branch', label: 'Branches', icon: GitBranch },
]

const MENU_CONTENT_CLASSNAME = 'bg-popover border-border/50 w-56'
const MENU_SUBCONTENT_CLASSNAME = 'bg-popover border-border/50'
const MENU_ITEM_CLASSNAME = 'text-white hover:bg-white/10'
const MENU_DESTRUCTIVE_ITEM_CLASSNAME =
	'text-red-400 hover:bg-red-500/10 hover:text-red-400'

type MenuRenderer = 'dropdown' | 'context'

interface MenuActionBase {
	key: string
	icon?: LucideIcon
	iconClassName?: string
	iconStyle?: CSSProperties
	className?: string
}

interface MenuItemAction extends MenuActionBase {
	type: 'item'
	label: string
	onSelect: () => void | Promise<void>
	disabled?: boolean
	variant?: 'default' | 'destructive'
}

interface MenuSeparatorAction {
	type: 'separator'
	key: string
	className?: string
}

interface MenuSubmenuAction extends MenuActionBase {
	type: 'submenu'
	label: string
	items: MenuAction[]
	contentClassName?: string
}

type MenuAction = MenuItemAction | MenuSeparatorAction | MenuSubmenuAction

interface ShareDialogState {
	conversationId: string
	conversationTitle: string
	selectedMessageIds: string[]
	allMessages: Message[]
}

type ConversationMenuSurface = 'dropdown' | 'context'

function renderMenuActionIcon(
	action: MenuItemAction | MenuSubmenuAction,
	baseClassName: string
) {
	if (!action.icon) return null

	const Icon = action.icon

	return (
		<Icon
			className={[baseClassName, action.iconClassName].filter(Boolean).join(' ')}
			style={action.iconStyle}
		/>
	)
}

function renderMenuActions(
	renderer: MenuRenderer,
	actions: MenuAction[]
): ReactNode {
	return actions.map((action) => {
		if (action.type === 'separator') {
			if (renderer === 'dropdown') {
				return (
					<DropdownMenuSeparator
						key={action.key}
						className={action.className ?? 'bg-white/10'}
					/>
				)
			}

			return (
				<ContextMenuSeparator
					key={action.key}
					className={action.className ?? 'bg-white/10'}
				/>
			)
		}

		if (action.type === 'submenu') {
			const triggerContent = (
				<>
					{renderMenuActionIcon(action, 'w-4 h-4 mr-2')}
					{action.label}
				</>
			)

			if (renderer === 'dropdown') {
				return (
					<DropdownMenuSub key={action.key}>
						<DropdownMenuSubTrigger
							className={action.className ?? MENU_ITEM_CLASSNAME}
						>
							{triggerContent}
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent
							className={action.contentClassName ?? MENU_SUBCONTENT_CLASSNAME}
						>
							{renderMenuActions(renderer, action.items)}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				)
			}

			return (
				<ContextMenuSub key={action.key}>
					<ContextMenuSubTrigger
						className={action.className ?? MENU_ITEM_CLASSNAME}
					>
						{triggerContent}
					</ContextMenuSubTrigger>
					<ContextMenuSubContent
						className={action.contentClassName ?? MENU_SUBCONTENT_CLASSNAME}
					>
						{renderMenuActions(renderer, action.items)}
					</ContextMenuSubContent>
				</ContextMenuSub>
			)
		}

		const className =
			action.className ??
			(action.variant === 'destructive'
				? MENU_DESTRUCTIVE_ITEM_CLASSNAME
				: MENU_ITEM_CLASSNAME)
		const itemContent = (
			<>
				{renderMenuActionIcon(action, 'w-4 h-4 mr-2')}
				{action.label}
			</>
		)

		if (renderer === 'dropdown') {
			return (
				<DropdownMenuItem
					key={action.key}
					onSelect={() => {
						void action.onSelect()
					}}
					disabled={action.disabled}
					variant={action.variant ?? 'default'}
					className={className}
				>
					{itemContent}
				</DropdownMenuItem>
			)
		}

		return (
			<ContextMenuItem
				key={action.key}
				onSelect={() => {
					void action.onSelect()
				}}
				disabled={action.disabled}
				variant={action.variant ?? 'default'}
				className={className}
			>
				{itemContent}
			</ContextMenuItem>
		)
	})
}

function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message.trim()) {
		return error.message
	}

	return fallback
}

export function Sidebar() {
	const { toast } = useToast()
	const [activeItem, setActiveItem] = useState<string | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [collectionsOpen, setCollectionsOpen] = useState(false)
	const [branchesOpen, setBranchesOpen] = useState(false)
	const [renameDialog, setRenameDialog] = useState<{
		id: string
		title: string
	} | null>(null)
	const [renameTitle, setRenameTitle] = useState('')
	const [shareDialog, setShareDialog] = useState<ShareDialogState | null>(null)
	const [shareLoadingId, setShareLoadingId] = useState<string | null>(null)
	const { settings, updateSettings, isLoaded } = useSettings()
	const { user } = useAuth()
	const { data: collections } = useCollections({ enabled: !!user })
	const [compactMode, setCompactMode] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const [openConversationMenu, setOpenConversationMenu] = useState<{
		id: string
		surface: ConversationMenuSurface
	} | null>(null)
	const [generatingTitles, setGeneratingTitles] = useState<Set<string>>(
		new Set()
	)

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
		invalidateConversations,
	} = useConversations({ limit: 10, pinned: false, enabled: !!user })
	const isRenameUnchanged = renameDialog
		? renameTitle.trim() === renameDialog.title.trim()
		: false

	useEffect(() => {
		if (!isLoaded) return

		const isMobile = window.innerWidth < 768
		const initialCompact = settings.compactMode || isMobile
		setCompactMode(initialCompact)
	}, [isLoaded, settings.compactMode])

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

	useEffect(() => {
		const handleChatChanged = () => {
			invalidateConversations()
		}

		window.addEventListener('chatChanged', handleChatChanged)
		return () => window.removeEventListener('chatChanged', handleChatChanged)
	}, [invalidateConversations])

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
		openConversation(conversationId)
		setActiveItem(conversationId)
	}, [])

	const handleNewChat = useCallback(() => {
		setActiveItem('new-chat')
		openNewChat()
	}, [])

	const closeRenameDialog = useCallback(() => {
		setRenameDialog(null)
		setRenameTitle('')
	}, [])

	const handleDeleteConversation = useCallback(
		async (conversationId: string) => {
			if (isDeleting) return

			try {
				await deleteConversation(conversationId)
				if (activeItem === conversationId) {
					handleNewChat()
				}
			} catch (error) {
				console.error('Failed to delete conversation:', error)
				toast({
					title: 'Failed to delete chat',
					description: getErrorMessage(error, 'Please try again.'),
					variant: 'destructive',
				})
			}
		},
		[activeItem, deleteConversation, handleNewChat, isDeleting, toast]
	)

	const handleStartRename = useCallback((conversation: ConversationPreview) => {
		setRenameDialog({ id: conversation.id, title: conversation.title })
		setRenameTitle(conversation.title)
	}, [])

	const handleSaveRename = useCallback(async () => {
		if (!renameDialog) return

		const title = renameTitle.trim()
		if (!title || title === renameDialog.title.trim()) return

		try {
			await updateConversation({ id: renameDialog.id, title })
			toast({
				title: 'Chat renamed',
				description: `Renamed to "${title}".`,
			})
			closeRenameDialog()
		} catch (error) {
			console.error('Failed to rename conversation:', error)
			toast({
				title: 'Failed to rename chat',
				description: getErrorMessage(error, 'Please try again.'),
				variant: 'destructive',
			})
		}
	}, [closeRenameDialog, renameDialog, renameTitle, toast, updateConversation])

	const getDestinationName = useCallback(
		(collectionId: string | null) => {
			if (collectionId === null) return 'Uncategorized'

			return (
				collections?.find((collection) => collection.id === collectionId)?.name ??
				'selected collection'
			)
		},
		[collections]
	)

	const handleMoveConversation = useCallback(
		async (conversation: ConversationPreview, collectionId: string | null) => {
			if ((conversation.collection?.id ?? null) === collectionId) return

			const destinationName = getDestinationName(collectionId)

			try {
				await updateConversation({ id: conversation.id, collectionId })
				toast({
					title: 'Chat moved',
					description: `Moved to ${destinationName}.`,
				})
			} catch (error) {
				console.error('Failed to move conversation:', error)
				toast({
					title: 'Failed to move chat',
					description: getErrorMessage(error, 'Please try again.'),
					variant: 'destructive',
				})
			}
		},
		[getDestinationName, toast, updateConversation]
	)

	const handleTogglePin = useCallback(
		async (conversation: ConversationPreview) => {
			try {
				await updateConversation({
					id: conversation.id,
					isPinned: !conversation.isPinned,
				})
				toast({
					title: conversation.isPinned ? 'Chat unpinned' : 'Chat pinned',
					description: conversation.isPinned
						? `"${conversation.title}" moved back to Recent.`
						: `"${conversation.title}" added to Pinned.`,
				})
			} catch (error) {
				console.error('Failed to update pin state:', error)
				toast({
					title: 'Failed to update pin',
					description: getErrorMessage(error, 'Please try again.'),
					variant: 'destructive',
				})
			}
		},
		[toast, updateConversation]
	)

	const handleOpenShareDialog = useCallback(
		async (conversation: ConversationPreview) => {
			if (shareLoadingId) return

			setShareLoadingId(conversation.id)
			try {
				const response = await fetch(`/api/conversations/${conversation.id}`, {
					credentials: 'include',
				})

				if (!response.ok) {
					const error = await response.json()
					throw new Error(error.error || 'Failed to load conversation.')
				}

				const data = await response.json()
				const shareableMessages: Message[] = data.conversation.messages
					.filter(
						(message: { role: string }) =>
							message.role === 'user' || message.role === 'assistant'
					)
					.map(
						(message: Omit<Message, 'createdAt'> & { createdAt?: string }) => ({
							...message,
							createdAt: message.createdAt
								? new Date(message.createdAt)
								: undefined,
						})
					)

				if (shareableMessages.length === 0) {
					toast({
						title: 'Nothing to share',
						description: 'This chat does not have shareable messages yet.',
						variant: 'destructive',
					})
					return
				}

				setShareDialog({
					conversationId: conversation.id,
					conversationTitle: data.conversation.title ?? conversation.title,
					selectedMessageIds: shareableMessages.map((message) => message.id),
					allMessages: shareableMessages,
				})
			} catch (error) {
				console.error('Failed to open share dialog:', error)
				toast({
					title: 'Failed to load share preview',
					description: getErrorMessage(error, 'Please try again.'),
					variant: 'destructive',
				})
			} finally {
				setShareLoadingId(null)
			}
		},
		[shareLoadingId, toast]
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

	const getConversationActions = useCallback(
		(conversation: ConversationPreview): MenuAction[] => [
			{
				type: 'item',
				key: 'open',
				label: 'Open chat',
				icon: MessageSquare,
				onSelect: () => handleChatClick(conversation.id),
			},
			{
				type: 'item',
				key: 'rename',
				label: 'Rename',
				icon: Edit2,
				onSelect: () => handleStartRename(conversation),
			},
			{
				type: 'item',
				key: 'share',
				label:
					shareLoadingId === conversation.id ? 'Loading share...' : 'Share',
				icon: shareLoadingId === conversation.id ? Loader2 : Share2,
				iconClassName: shareLoadingId === conversation.id ? 'animate-spin' : '',
				onSelect: () => handleOpenShareDialog(conversation),
				disabled: conversation.messageCount === 0 || shareLoadingId !== null,
			},
			{
				type: 'submenu',
				key: 'move',
				label: 'Move to...',
				icon: Folder,
				items: [
					{
						type: 'item',
						key: 'move-uncategorized',
						label: 'Uncategorized',
						icon: FolderOpen,
						iconClassName: 'text-gray-500',
						onSelect: () => handleMoveConversation(conversation, null),
						disabled: conversation.collection === null,
					},
					...(collections?.map((collection: Collection) => ({
						type: 'item' as const,
						key: `move-${collection.id}`,
						label: collection.name,
						icon: Folder,
						iconStyle: { color: collection.color },
						onSelect: () =>
							handleMoveConversation(conversation, collection.id),
						disabled: conversation.collection?.id === collection.id,
					})) ?? []),
				],
			},
			{
				type: 'item',
				key: 'pin',
				label: conversation.isPinned ? 'Unpin chat' : 'Pin chat',
				icon: conversation.isPinned ? PinOff : Pin,
				onSelect: () => handleTogglePin(conversation),
			},
			{ type: 'separator', key: 'separator-delete' },
			{
				type: 'item',
				key: 'delete',
				label: 'Delete chat',
				icon: Trash2,
				onSelect: () => handleDeleteConversation(conversation.id),
				variant: 'destructive',
			},
		],
		[
			collections,
			handleChatClick,
			handleDeleteConversation,
			handleMoveConversation,
			handleOpenShareDialog,
			handleStartRename,
			handleTogglePin,
			shareLoadingId,
		]
	)

	const handleConversationMenuOpenChange = useCallback(
		(
			conversationId: string,
			surface: ConversationMenuSurface,
			open: boolean
		) => {
			setOpenConversationMenu((current) => {
				if (open) return { id: conversationId, surface }
				return current?.id === conversationId && current.surface === surface
					? null
					: current
			})
		},
		[]
	)

	const renderConversationRow = (conversation: ConversationPreview) => {
		const menuActions = getConversationActions(conversation)
		const conversationRow = (
			<div
				onClick={() => handleChatClick(conversation.id)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						handleChatClick(conversation.id)
					}
				}}
				className={`flex items-start gap-3 w-full px-3 py-2 group text-left hover:bg-sidebar-accent/30 rounded-md transition-colors ${
					activeItem === conversation.id ? 'bg-sidebar-accent/50' : ''
				}`}
				role="button"
				tabIndex={0}
			>
				<div className="relative z-10 flex-shrink-0 mt-0.5">
					<div
						className={`w-1.5 h-1.5 rounded-full transition-colors ${
							activeItem === conversation.id
								? 'bg-primary'
								: 'bg-border group-hover:bg-foreground'
						}`}
					/>
				</div>
				<div className="min-w-0 flex-1">
					{generatingTitles.has(conversation.id) ? (
						<Skeleton className="h-4 w-32 mb-1" />
					) : (
						<div className="text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors font-medium">
							{conversation.title}
						</div>
					)}
					<div className="flex items-center gap-2 mt-0.5">
						<span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider">
							{conversation.messageCount} msgs
						</span>
						<span className="text-[10px] text-muted-foreground/40">
							{formatTimestamp(conversation.updatedAt)}
						</span>
					</div>
				</div>
				<div className="flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
					<DropdownMenu
						open={
							openConversationMenu?.id === conversation.id &&
							openConversationMenu.surface === 'dropdown'
						}
						onOpenChange={(open) =>
							handleConversationMenuOpenChange(
								conversation.id,
								'dropdown',
								open
							)
						}
					>
						<DropdownMenuTrigger asChild>
							<button
								onClick={(e) => e.stopPropagation()}
								onPointerDown={(e) => e.stopPropagation()}
								className="flex items-center justify-center p-1 text-muted-foreground hover:text-foreground focus-visible:text-foreground hover:bg-sidebar-accent/50 focus-visible:bg-sidebar-accent/50 rounded-md transition-colors"
								aria-label={`More actions for ${conversation.title}`}
								type="button"
							>
								<MoreVertical className="w-3.5 h-3.5" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							side="right"
							align="start"
							sideOffset={10}
							className={MENU_CONTENT_CLASSNAME}
							onClick={(e) => e.stopPropagation()}
						>
							{renderMenuActions('dropdown', menuActions)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		)

		return (
			<ContextMenu
				key={conversation.id}
				onOpenChange={(open) =>
					handleConversationMenuOpenChange(conversation.id, 'context', open)
				}
			>
				<ContextMenuTrigger asChild>{conversationRow}</ContextMenuTrigger>
				<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
					{renderMenuActions('context', menuActions)}
				</ContextMenuContent>
			</ContextMenu>
		)
	}

	const renderConversationSection = (
		title: string,
		conversations: ConversationPreview[],
		emptyState?: ReactNode
	) => {
		if (conversations.length === 0 && !emptyState) {
			return null
		}

		return (
			<div className="relative">
				<h3 className="px-3 mb-3 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 font-sans">
					{title}
				</h3>
				{conversations.length > 0 && (
					<div className="absolute left-[23px] top-[32px] bottom-0 w-[1px] bg-border/40" />
				)}
				<div className="space-y-1 relative">
					{conversations.length > 0
						? conversations.map(renderConversationRow)
						: emptyState}
				</div>
			</div>
		)
	}

	const hasPinnedConversations = pinnedConversations.length > 0
	const hasRecentConversations = recentConversations.length > 0
	const showConversationLoader =
		(pinnedLoading || recentLoading) &&
		!hasPinnedConversations &&
		!hasRecentConversations
	const hasOpenConversationMenu = openConversationMenu !== null
	const isSidebarCollapsed =
		compactMode && !isHovered && !hasOpenConversationMenu
	const isSidebarExpanded = !isSidebarCollapsed

	return (
		<>
			<aside
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				className={`h-full flex flex-col bg-sidebar transition-all duration-300 ${
					isSidebarCollapsed ? 'w-[4rem]' : 'w-[280px]'
				}`}
			>
				<div
					className={`${isSidebarCollapsed ? 'px-3 pt-12 pb-10' : 'px-6 pt-12 pb-10 flex items-start justify-between'} transition-all duration-300`}
				>
					{isSidebarCollapsed ? (
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

				<div
					className={`${isSidebarCollapsed ? 'px-2' : 'px-4'} pb-4 transition-all duration-300`}
				>
					<button
						onClick={() => setSearchOpen(true)}
						className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} w-full ${isSidebarCollapsed ? 'p-2' : 'px-3 py-2'} text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30 rounded-md transition-all`}
						title="Search conversations"
					>
						<Search className="w-4 h-4" />
						{isSidebarExpanded && <span>Search</span>}
					</button>
				</div>

				<div
					className={`${isSidebarCollapsed ? 'px-2' : 'px-4'} pb-8 space-y-1 transition-all duration-300`}
				>
					<button
						onClick={handleNewChat}
						className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} w-full ${isSidebarCollapsed ? 'p-2.5' : 'px-3 py-2.5'} text-sm font-medium text-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent rounded-md transition-all group border border-transparent hover:border-border`}
						title={isSidebarCollapsed ? 'New Discussion' : undefined}
					>
						<div className="p-1 rounded bg-background border border-border group-hover:border-foreground/20 transition-colors">
							<Plus className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
						</div>
						{isSidebarExpanded && <span>New Discussion</span>}
					</button>
				</div>

				<div
					className={`${isSidebarCollapsed ? 'px-2' : 'px-4'} space-y-8 overflow-y-auto flex-1 transition-all duration-300`}
				>
					<div>
						{isSidebarExpanded && (
							<h3 className="px-3 mb-3 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 font-sans">
								Library
							</h3>
						)}
						<div className="space-y-0.5">
							{featureItems.map((item) => (
								<button
									key={item.id}
									onClick={() => handleFeatureClick(item.id)}
									className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} w-full ${isSidebarCollapsed ? 'p-2' : 'px-3 py-2'} text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-all group`}
									title={isSidebarCollapsed ? item.label : undefined}
								>
									<item.icon className="w-4 h-4 stroke-[1.5] text-muted-foreground/70 group-hover:text-primary transition-colors" />
									{isSidebarExpanded && (
										<span className="opacity-100 transition-opacity duration-300">
											{item.label}
										</span>
									)}
								</button>
							))}
						</div>
					</div>

					{isSidebarExpanded && (
						<>
							{showConversationLoader ? (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
								</div>
							) : (
								<>
									{hasPinnedConversations &&
										renderConversationSection('Pinned', pinnedConversations)}

									{renderConversationSection(
										'Recent',
										recentConversations,
										!hasPinnedConversations ? (
											<p className="px-3 py-4 text-sm text-muted-foreground/60 italic">
												No conversations yet
											</p>
										) : null
									)}
								</>
							)}
						</>
					)}
				</div>

				<div
					className={`mt-auto ${isSidebarCollapsed ? 'px-2' : 'px-4'} pb-8 transition-all duration-300`}
				>
					<button
						onClick={() => setSettingsOpen(true)}
						className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} w-full ${isSidebarCollapsed ? 'p-2' : 'px-3 py-2'} text-sm text-muted-foreground hover:text-foreground transition-colors`}
						title={isSidebarCollapsed ? 'Preferences' : undefined}
					>
						<Settings className="w-4 h-4" />
						{isSidebarExpanded && <span>Preferences</span>}
					</button>
				</div>
			</aside>

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

			<Dialog
				open={renameDialog !== null}
				onOpenChange={(open) => {
					if (!open) closeRenameDialog()
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Rename chat</DialogTitle>
						<DialogDescription>
							Update the title shown in your sidebar.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={renameTitle}
						onChange={(event) => setRenameTitle(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								void handleSaveRename()
							}
						}}
						placeholder="Chat title"
						autoFocus
					/>
					<DialogFooter>
						<Button variant="outline" onClick={closeRenameDialog}>
							Cancel
						</Button>
						<Button
							onClick={() => {
								void handleSaveRename()
							}}
							disabled={!renameTitle.trim() || isRenameUnchanged || isUpdating}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{shareDialog && (
				<SelectiveShareModal
					open={!!shareDialog}
					onOpenChange={(open) => {
						if (!open) {
							setShareDialog(null)
						}
					}}
					conversationId={shareDialog.conversationId}
					conversationTitle={shareDialog.conversationTitle}
					selectedMessageIds={shareDialog.selectedMessageIds}
					allMessages={shareDialog.allMessages}
				/>
			)}
		</>
	)
}
