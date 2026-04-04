'use client'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { useToast } from '@/hooks/use-toast'
import { openConversation } from '@/lib/chat-navigation'
import {
	useCollections,
	useCreateCollection,
	useDeleteCollection,
	useUpdateCollection,
} from '@/hooks/use-collections'
import { useConversations } from '@/hooks/use-conversations'
import {
	ArrowLeft,
	Calendar,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Edit2,
	Expand,
	Folder,
	FolderOpen,
	MessageSquare,
	MoreVertical,
	Plus,
	Search,
	Shrink,
	SortAsc,
	Trash2,
	X,
	type LucideIcon,
} from 'lucide-react'
import {
	useEffect,
	useMemo,
	useState,
	type CSSProperties,
	type ReactNode,
} from 'react'

const PRESET_COLORS = [
	'#57FCFF',
	'#FF6B9D',
	'#FFD93D',
	'#9B59B6',
	'#2ECC71',
	'#E67E22',
	'#95A5A6',
	'#E74C3C',
]
const FOLDER_PAGE_SIZE = 100

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'older'
type SortOrder = 'recent' | 'oldest' | 'alphabetical'
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

const MENU_CONTENT_CLASSNAME = 'bg-popover border-border/50 w-48'
const MENU_SUBCONTENT_CLASSNAME = 'bg-popover border-border/50'
const MENU_ITEM_CLASSNAME = 'text-white hover:bg-white/10'
const MENU_DESTRUCTIVE_ITEM_CLASSNAME =
	'text-red-400 hover:bg-red-500/10 hover:text-red-400'

function renderMenuActionIcon(
	action: MenuItemAction | MenuSubmenuAction,
	baseClassName: string
) {
	if (!action.icon) return null

	const Icon = action.icon

	return (
		<Icon
			className={[baseClassName, action.iconClassName]
				.filter(Boolean)
				.join(' ')}
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

		const itemContent = (
			<>
				{renderMenuActionIcon(action, 'w-4 h-4 mr-2')}
				{action.label}
			</>
		)
		const className =
			action.className ??
			(action.variant === 'destructive'
				? MENU_DESTRUCTIVE_ITEM_CLASSNAME
				: MENU_ITEM_CLASSNAME)

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

function isMenuItemAction(action: MenuAction): action is MenuItemAction {
	return action.type === 'item'
}

function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message.trim()) {
		return error.message
	}

	return fallback
}

interface CollectionsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CollectionsModal({
	open,
	onOpenChange,
}: CollectionsModalProps) {
	const { toast } = useToast()
	const { data: collections, isLoading, error } = useCollections()
	const createCollection = useCreateCollection()
	const updateCollection = useUpdateCollection()
	const deleteCollection = useDeleteCollection()

	// Folder management state
	const [newCollectionName, setNewCollectionName] = useState('')
	const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState('')
	const [deleteConfirm, setDeleteConfirm] = useState<{
		id: string
		name: string
	} | null>(null)

	// Folder inspection state
	const [inspectingFolder, setInspectingFolder] = useState<{
		id: string | null
		name: string
		color: string
	} | null>(null)

	// Search state
	const [folderSearch, setFolderSearch] = useState('')
	const [chatSearch, setChatSearch] = useState('')
	const [folderPage, setFolderPage] = useState(1)

	// Filter/sort state
	const [dateFilter, setDateFilter] = useState<DateFilter>('all')
	const [sortOrder, setSortOrder] = useState<SortOrder>('recent')

	// Multi-select state
	const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set())
	const [isSelectMode, setIsSelectMode] = useState(false)

	// Expand/collapse state
	const [isExpanded, setIsExpanded] = useState(false)

	// Move dialog state
	const [showMoveDialog, setShowMoveDialog] = useState(false)

	// Delete chat confirmation
	const [deleteChatConfirm, setDeleteChatConfirm] = useState<{
		ids: string[]
		count: number
	} | null>(null)

	// Fetch chats for the inspecting folder
	const {
		conversations: folderChats,
		pagination: folderPagination,
		isLoading: isLoadingChats,
		updateConversation,
		deleteConversation,
		invalidateConversations,
	} = useConversations({
		page: folderPage,
		collectionId: inspectingFolder?.id,
		search: chatSearch,
		limit: FOLDER_PAGE_SIZE,
		enabled: inspectingFolder !== null,
	})

	// Fetch uncategorized chats count
	const { pagination: uncategorizedPagination } = useConversations({
		page: 1,
		collectionId: null,
		limit: FOLDER_PAGE_SIZE,
		enabled: open && !inspectingFolder,
	})
	const totalFolderChats = folderPagination?.total ?? 0
	const uncategorizedCount = uncategorizedPagination?.total ?? 0
	const getFolderDestinationName = (folderId: string | null) => {
		if (folderId === null) return 'Uncategorized'

		return (
			collections?.find((folder) => folder.id === folderId)?.name ??
			'selected folder'
		)
	}

	// Filter folders by search
	const filteredFolders = useMemo(() => {
		if (!collections) return []
		if (!folderSearch.trim()) return collections
		const term = folderSearch.toLowerCase()
		return collections.filter((c) => c.name.toLowerCase().includes(term))
	}, [collections, folderSearch])

	// Filter and sort chats
	const filteredChats = useMemo(() => {
		let chats = [...(folderChats ?? [])]

		// Filter by date
		const now = new Date()
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
		const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
		const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

		if (dateFilter !== 'all') {
			chats = chats.filter((c) => {
				const chatDate = new Date(c.updatedAt)
				switch (dateFilter) {
					case 'today':
						return chatDate >= today
					case 'week':
						return chatDate >= weekAgo
					case 'month':
						return chatDate >= monthAgo
					case 'older':
						return chatDate < monthAgo
					default:
						return true
				}
			})
		}

		// Sort
		switch (sortOrder) {
			case 'oldest':
				chats.sort(
					(a, b) =>
						new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
				)
				break
			case 'alphabetical':
				chats.sort((a, b) => a.title.localeCompare(b.title))
				break
			case 'recent':
			default:
				chats.sort(
					(a, b) =>
						new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				)
		}

		return chats
	}, [folderChats, dateFilter, sortOrder])

	// Keyboard shortcuts
	useEffect(() => {
		if (!open) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if (!inspectingFolder) return

			// Ctrl/Cmd + A: Select all
			if ((e.ctrlKey || e.metaKey) && e.key === 'a' && isSelectMode) {
				e.preventDefault()
				setSelectedChats(new Set(filteredChats.map((c) => c.id)))
			}

			// Ctrl/Cmd + M: Move selected
			if ((e.ctrlKey || e.metaKey) && e.key === 'm' && selectedChats.size > 0) {
				e.preventDefault()
				setShowMoveDialog(true)
			}

			// Escape: Deselect or exit select mode
			if (e.key === 'Escape') {
				if (selectedChats.size > 0) {
					setSelectedChats(new Set())
				} else if (isSelectMode) {
					setIsSelectMode(false)
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [open, inspectingFolder, isSelectMode, selectedChats, filteredChats])

	// Reset state when closing
	useEffect(() => {
		if (!open) {
			setInspectingFolder(null)
			setFolderSearch('')
			setChatSearch('')
			setFolderPage(1)
			setSelectedChats(new Set())
			setIsSelectMode(false)
			setDateFilter('all')
			setSortOrder('recent')
		}
	}, [open])

	useEffect(() => {
		setSelectedChats(new Set())
	}, [folderPage])

	useEffect(() => {
		setFolderPage(1)
	}, [chatSearch])

	useEffect(() => {
		if (!inspectingFolder || !folderPagination) return

		const lastPage = Math.max(folderPagination.totalPages, 1)
		if (folderPage > lastPage) {
			setFolderPage(lastPage)
		}
	}, [folderPage, folderPagination, inspectingFolder])

	// Handlers
	const handleCreate = async () => {
		if (!newCollectionName.trim()) return
		const folderName = newCollectionName.trim()
		try {
			await createCollection.mutateAsync({
				name: folderName,
				color: selectedColor,
			})
			setNewCollectionName('')
			setSelectedColor(PRESET_COLORS[0])
			toast({
				title: 'Folder created',
				description: `"${folderName}" is ready.`,
			})
		} catch (error) {
			console.error('Failed to create collection:', error)
			toast({
				title: 'Failed to create folder',
				description: getErrorMessage(error, 'Please try again.'),
				variant: 'destructive',
			})
		}
	}

	const handleStartEdit = (id: string, name: string) => {
		setEditingId(id)
		setEditingName(name)
	}

	const handleSaveEdit = async (id: string) => {
		if (!editingName.trim()) return
		const folderName = editingName.trim()
		const currentFolderName = collections?.find(
			(collection) => collection.id === id
		)?.name

		if (currentFolderName?.trim() === folderName) return

		try {
			await updateCollection.mutateAsync({
				id,
				data: { name: folderName },
			})
			setEditingId(null)
			setEditingName('')
			toast({
				title: 'Folder renamed',
				description: `Renamed to "${folderName}".`,
			})
		} catch (error) {
			console.error('Failed to update collection:', error)
			toast({
				title: 'Failed to rename folder',
				description: getErrorMessage(error, 'Please try again.'),
				variant: 'destructive',
			})
		}
	}

	const handleCancelEdit = () => {
		setEditingId(null)
		setEditingName('')
	}

	const handleDeleteFolder = (id: string, isDefault: boolean, name: string) => {
		if (isDefault) return
		setDeleteConfirm({ id, name })
	}

	const confirmDeleteFolder = async () => {
		if (!deleteConfirm) return
		const folderName = deleteConfirm.name
		try {
			await deleteCollection.mutateAsync(deleteConfirm.id)
			setDeleteConfirm(null)
			if (inspectingFolder?.id === deleteConfirm.id) {
				setInspectingFolder(null)
			}
			toast({
				title: 'Folder deleted',
				description: `"${folderName}" was deleted and its chats were moved to Uncategorized.`,
			})
		} catch (error) {
			console.error('Failed to delete collection:', error)
			toast({
				title: 'Failed to delete folder',
				description: getErrorMessage(error, 'Please try again.'),
				variant: 'destructive',
			})
		}
	}

	const handleFolderClick = (folder: {
		id: string | null
		name: string
		color: string
	}) => {
		setFolderPage(1)
		setInspectingFolder(folder)
		setChatSearch('')
		setSelectedChats(new Set())
		setIsSelectMode(false)
	}

	const handleBackToFolders = () => {
		setFolderPage(1)
		setInspectingFolder(null)
		setChatSearch('')
		setSelectedChats(new Set())
		setIsSelectMode(false)
	}

	const toggleChatSelection = (chatId: string) => {
		const newSelection = new Set(selectedChats)
		if (newSelection.has(chatId)) {
			newSelection.delete(chatId)
		} else {
			newSelection.add(chatId)
		}
		setSelectedChats(newSelection)
	}

	const handleSelectAll = () => {
		if (selectedChats.size === filteredChats.length) {
			setSelectedChats(new Set())
		} else {
			setSelectedChats(new Set(filteredChats.map((c) => c.id)))
		}
	}

	const handleMoveChats = async (targetFolderId: string | null) => {
		const chatIdsToMove = Array.from(selectedChats).filter((chatId) => {
			const currentFolderId =
				filteredChats.find((chat) => chat.id === chatId)?.collection?.id ?? null

			return currentFolderId !== targetFolderId
		})
		if (chatIdsToMove.length === 0) return

		const movedCount = chatIdsToMove.length
		const destinationName = getFolderDestinationName(targetFolderId)
		try {
			const promises = chatIdsToMove.map((chatId) =>
				updateConversation({ id: chatId, collectionId: targetFolderId })
			)
			await Promise.all(promises)
			setSelectedChats(new Set())
			setIsSelectMode(false)
			setShowMoveDialog(false)
			invalidateConversations()
			toast({
				title: movedCount === 1 ? 'Chat moved' : 'Chats moved',
				description:
					movedCount === 1
						? `Moved to ${destinationName}.`
						: `${movedCount} chats moved to ${destinationName}.`,
			})
		} catch (error) {
			console.error('Failed to move chats:', error)
			toast({
				title: 'Failed to move chats',
				description: getErrorMessage(error, 'Please try again.'),
				variant: 'destructive',
			})
		}
	}

	const handleMoveSingleChat = async (
		chatId: string,
		targetFolderId: string | null
	) => {
		const currentFolderId =
			filteredChats.find((chat) => chat.id === chatId)?.collection?.id ?? null

		if (currentFolderId === targetFolderId) return

		const destinationName = getFolderDestinationName(targetFolderId)
		try {
			await updateConversation({ id: chatId, collectionId: targetFolderId })
			invalidateConversations()
			toast({
				title: 'Chat moved',
				description: `Moved to ${destinationName}.`,
			})
		} catch (error) {
			console.error('Failed to move chat:', error)
			toast({
				title: 'Failed to move chat',
				description: getErrorMessage(error, 'Please try again.'),
				variant: 'destructive',
			})
		}
	}

	const handleOpenChat = (chatId: string) => {
		openConversation(chatId)
		onOpenChange(false)
	}

	const handleDeleteChats = (chatIds: string[]) => {
		setDeleteChatConfirm({ ids: chatIds, count: chatIds.length })
	}

	const confirmDeleteChats = async () => {
		if (!deleteChatConfirm) return
		const deletedCount = deleteChatConfirm.count
		try {
			const promises = deleteChatConfirm.ids.map((id) => deleteConversation(id))
			await Promise.all(promises)
			setSelectedChats(new Set())
			setDeleteChatConfirm(null)
			invalidateConversations()
			toast({
				title: deletedCount === 1 ? 'Chat deleted' : 'Chats deleted',
				description:
					deletedCount === 1
						? 'The chat was deleted.'
						: `${deletedCount} chats were deleted.`,
			})
		} catch (error) {
			console.error('Failed to delete chats:', error)
			toast({
				title: 'Failed to delete chats',
				description: getErrorMessage(error, 'Please try again.'),
				variant: 'destructive',
			})
		}
	}

	const formatRelativeTime = (dateString: string) => {
		const date = new Date(dateString)
		const now = new Date()
		const diff = now.getTime() - date.getTime()
		const minutes = Math.floor(diff / 60000)
		const hours = Math.floor(diff / 3600000)
		const days = Math.floor(diff / 86400000)

		if (minutes < 1) return 'Just now'
		if (minutes < 60) return `${minutes}m ago`
		if (hours < 24) return `${hours}h ago`
		if (days < 7) return `${days}d ago`
		return date.toLocaleDateString()
	}

	const uncategorizedFolder = {
		id: null as string | null,
		name: 'Uncategorized',
		color: '#6B7280',
	}

	const getFolderActions = (folder: {
		id: string | null
		name: string
		color: string
		isDefault?: boolean
	}): MenuAction[] => {
		const actions: MenuAction[] = [
			{
				type: 'item',
				key: 'open',
				label: 'Open folder',
				icon: FolderOpen,
				onSelect: () =>
					handleFolderClick({
						id: folder.id,
						name: folder.name,
						color: folder.color,
					}),
			},
		]

		if (folder.id === null) {
			return actions
		}

		actions.push({
			type: 'item',
			key: 'rename',
			label: 'Rename',
			icon: Edit2,
			onSelect: () => handleStartEdit(folder.id as string, folder.name),
		})

		if (!folder.isDefault) {
			actions.push({
				type: 'item',
				key: 'delete',
				label: 'Delete',
				icon: Trash2,
				onSelect: () =>
					handleDeleteFolder(folder.id as string, false, folder.name),
				variant: 'destructive',
			})
		}

		return actions
	}

	const getChatActions = (chat: {
		id: string
		title: string
	}): MenuAction[] => [
		{
			type: 'item',
			key: 'open',
			label: 'Open chat',
			icon: MessageSquare,
			onSelect: () => handleOpenChat(chat.id),
		},
		{ type: 'separator', key: 'separator-open' },
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
					onSelect: () => handleMoveSingleChat(chat.id, null),
					disabled: inspectingFolder?.id === null,
				},
				...(collections?.map((folder) => ({
					type: 'item' as const,
					key: `move-${folder.id}`,
					label: folder.name,
					icon: Folder,
					iconStyle: { color: folder.color },
					onSelect: () => handleMoveSingleChat(chat.id, folder.id),
					disabled: folder.id === inspectingFolder?.id,
				})) ?? []),
			],
		},
		{ type: 'separator', key: 'separator-delete' },
		{
			type: 'item',
			key: 'delete',
			label: 'Delete',
			icon: Trash2,
			onSelect: () => handleDeleteChats([chat.id]),
			variant: 'destructive',
		},
	]

	const renderFolderActionButtons = (actions: MenuAction[]) => {
		const buttonActions = actions.filter(
			(action): action is MenuItemAction =>
				action.type === 'item' && action.key !== 'open'
		)

		return buttonActions.map((action) => {
			const Icon = action.icon

			return (
				<Button
					key={action.key}
					size="sm"
					variant="ghost"
					onClick={() => {
						void action.onSelect()
					}}
					className={
						action.variant === 'destructive'
							? 'h-7 w-7 p-0 hover:bg-red-500/20 rounded-full'
							: 'h-7 w-7 p-0 hover:bg-white/10 rounded-full'
					}
					aria-label={action.label}
				>
					{Icon && (
						<Icon
							className={['w-3.5 h-3.5 text-gray-400', action.iconClassName]
								.filter(Boolean)
								.join(' ')}
							style={action.iconStyle}
						/>
					)}
				</Button>
			)
		})
	}

	// Render folder grid view
	const renderFolderGrid = () => (
		<>
			<div className="space-y-4">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<Input
						placeholder="Search folders..."
						value={folderSearch}
						onChange={(e) => setFolderSearch(e.target.value)}
						className="pl-10 h-[42px] bg-white/5 border-white/10 text-white rounded-[11px]"
					/>
				</div>

				<div className="flex items-center gap-4">
					<Input
						placeholder="New folder name"
						value={newCollectionName}
						onChange={(e) => setNewCollectionName(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
						className="flex-1 h-[42px] bg-white/5 border-white/10 text-white rounded-[11px] px-4"
					/>
					<div className="flex items-center gap-2">
						{PRESET_COLORS.map((color) => (
							<button
								key={color}
								onClick={() => setSelectedColor(color)}
								className={`w-6 h-6 rounded-full transition-all ${
									selectedColor === color
										? 'ring-2 ring-white/50 ring-offset-2 ring-offset-[#0a0d11]'
										: 'hover:ring-1 hover:ring-white/30'
								}`}
								style={{ backgroundColor: color }}
							/>
						))}
					</div>
					<Button
						onClick={handleCreate}
						disabled={!newCollectionName.trim() || createCollection.isPending}
						className="h-[42px] px-6 bg-[#00D5BE] hover:bg-[#00D5BE]/80 text-black font-bold rounded-[11px]"
					>
						<Plus className="w-4 h-4 mr-2" />
						Add
					</Button>
				</div>
			</div>

			<div className="h-px bg-[#5F5F5F]" />

			<div>
				{error ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<Folder className="w-16 h-16 text-red-400/30 mb-4" />
						<p className="text-red-400 text-sm">Failed to load folders</p>
					</div>
				) : isLoading ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="w-16 h-16 rounded-full bg-white/5 animate-pulse mb-4" />
						<p className="text-gray-400 text-sm">Loading folders...</p>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
						{/* Uncategorized pseudo-folder */}
						<ContextMenu>
							<ContextMenuTrigger asChild>
								<div
									onClick={() => handleFolderClick(uncategorizedFolder)}
									className="group relative bg-card/40 hover:bg-card/60 border border-dashed border-border/50 rounded-[20px] p-6 transition-all cursor-pointer"
								>
									<div className="flex flex-col items-center text-center space-y-3">
										<FolderOpen className="w-[74px] h-[74px] text-gray-500" />
										<div>
											<h3 className="text-gray-400 font-bold text-[16px] mb-1">
												Uncategorized
											</h3>
											<p className="text-[#9C9C9C] text-[12px]">
												{uncategorizedCount} chat
												{uncategorizedCount !== 1 ? 's' : ''}
											</p>
										</div>
									</div>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
								{renderMenuActions(
									'context',
									getFolderActions(uncategorizedFolder)
								)}
							</ContextMenuContent>
						</ContextMenu>

						{/* Regular folders */}
						{filteredFolders?.map((collection) => {
							const folderActions = getFolderActions({
								id: collection.id,
								name: collection.name,
								color: collection.color,
								isDefault: collection.isDefault,
							})

							if (editingId === collection.id) {
								const isRenameUnchanged =
									editingName.trim() === collection.name.trim()

								return (
									<div
										key={collection.id}
										className="group relative bg-card/40 hover:bg-card/50 border border-border/40 rounded-[20px] p-6 transition-all cursor-pointer"
									>
										<div
											className="flex flex-col items-center space-y-4"
											onClick={(e) => e.stopPropagation()}
										>
											<Folder
												className="w-[74px] h-[74px] mb-2"
												style={{ color: collection.color }}
											/>
											<Input
												value={editingName}
												onChange={(e) => setEditingName(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter') handleSaveEdit(collection.id)
													if (e.key === 'Escape') handleCancelEdit()
												}}
												className="w-full h-10 bg-white/10 border-white/20 text-white text-center"
												autoFocus
											/>
											<div className="flex gap-2">
												<Button
													onClick={handleCancelEdit}
													size="sm"
													variant="ghost"
													className="h-10 w-10 rounded-[14px] border border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white"
													aria-label="Cancel folder rename"
												>
													<X className="w-4 h-4" />
												</Button>
												<Button
													onClick={() => handleSaveEdit(collection.id)}
													size="sm"
													className="h-10 w-10 rounded-[14px] border border-[#57FCFF]/30 bg-[#57FCFF]/12 text-[#57FCFF] shadow-none hover:bg-[#57FCFF]/20"
													aria-label="Save folder rename"
													disabled={
														!editingName.trim() ||
														isRenameUnchanged ||
														updateCollection.isPending
													}
												>
													<Check className="w-4 h-4" />
												</Button>
											</div>
										</div>
									</div>
								)
							}

							return (
								<ContextMenu key={collection.id}>
									<ContextMenuTrigger asChild>
										<div
											className="group relative bg-card/40 hover:bg-card/50 border border-border/40 rounded-[20px] p-6 transition-all cursor-pointer"
											onClick={() =>
												handleFolderClick({
													id: collection.id,
													name: collection.name,
													color: collection.color,
												})
											}
										>
											<div
												className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
												onClick={(e) => e.stopPropagation()}
											>
												{renderFolderActionButtons(folderActions)}
											</div>

											<div className="flex flex-col items-center text-center space-y-3">
												<Folder
													className="w-[74px] h-[74px]"
													style={{ color: collection.color }}
												/>
												<div>
													<h3 className="text-white font-bold text-[16px] mb-1">
														{collection.name}
														{collection.isDefault && (
															<span className="text-xs text-gray-500 ml-2">
																(default)
															</span>
														)}
													</h3>
													<p className="text-[#9C9C9C] text-[12px]">
														{collection._count.conversations} chat
														{collection._count.conversations !== 1 ? 's' : ''}
													</p>
												</div>
											</div>
										</div>
									</ContextMenuTrigger>
									<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
										{renderMenuActions('context', folderActions)}
									</ContextMenuContent>
								</ContextMenu>
							)
						})}

						{filteredFolders?.length === 0 && folderSearch && (
							<div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
								<Search className="w-10 h-10 text-gray-500 mb-3" />
								<p className="text-gray-400 text-sm">
									No folders matching "{folderSearch}"
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</>
	)

	// Render folder inspection view
	const renderFolderInspection = () => (
		<>
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleBackToFolders}
						className="h-9 px-3 hover:bg-white/10"
					>
						<ArrowLeft className="w-4 h-4 mr-2" />
						Back
					</Button>
					<div className="flex items-center gap-2">
						<Folder
							className="w-6 h-6"
							style={{ color: inspectingFolder?.color }}
						/>
						<h2 className="text-xl font-bold text-white">
							{inspectingFolder?.name}
						</h2>
					</div>
				</div>

				<Button
					variant={isSelectMode ? 'default' : 'outline'}
					size="sm"
					onClick={() => {
						setIsSelectMode(!isSelectMode)
						if (isSelectMode) setSelectedChats(new Set())
					}}
					className={
						isSelectMode
							? 'bg-[#57FCFF] text-black hover:bg-[#57FCFF]/80'
							: 'border-white/20 text-white hover:bg-white/10'
					}
				>
					{isSelectMode ? 'Done' : 'Select'}
				</Button>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<Input
						placeholder="Search chats..."
						value={chatSearch}
						onChange={(e) => setChatSearch(e.target.value)}
						className="pl-10 h-[38px] bg-white/5 border-white/10 text-white rounded-[11px]"
					/>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-[38px] border-white/20 text-white hover:bg-white/10"
						>
							<Calendar className="w-4 h-4 mr-2" />
							{dateFilter === 'all'
								? 'All time'
								: dateFilter === 'today'
									? 'Today'
									: dateFilter === 'week'
										? 'This week'
										: dateFilter === 'month'
											? 'This month'
											: 'Older'}
							<ChevronDown className="w-4 h-4 ml-2" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="bg-popover border-border/50">
						{(['all', 'today', 'week', 'month', 'older'] as DateFilter[]).map(
							(filter) => (
								<DropdownMenuItem
									key={filter}
									onSelect={() => setDateFilter(filter)}
									className={
										dateFilter === filter ? 'bg-white/10' : 'hover:bg-white/5'
									}
								>
									{filter === 'all'
										? 'All time'
										: filter === 'today'
											? 'Today'
											: filter === 'week'
												? 'This week'
												: filter === 'month'
													? 'This month'
													: 'Older'}
								</DropdownMenuItem>
							)
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-[38px] border-white/20 text-white hover:bg-white/10"
						>
							<SortAsc className="w-4 h-4 mr-2" />
							{sortOrder === 'recent'
								? 'Recent'
								: sortOrder === 'oldest'
									? 'Oldest'
									: 'A-Z'}
							<ChevronDown className="w-4 h-4 ml-2" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="bg-popover border-border/50">
						{(['recent', 'oldest', 'alphabetical'] as SortOrder[]).map(
							(order) => (
								<DropdownMenuItem
									key={order}
									onSelect={() => setSortOrder(order)}
									className={
										sortOrder === order ? 'bg-white/10' : 'hover:bg-white/5'
									}
								>
									{order === 'recent'
										? 'Most recent'
										: order === 'oldest'
											? 'Oldest first'
											: 'Alphabetical'}
								</DropdownMenuItem>
							)
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{isSelectMode && (
				<div className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
					<div className="flex items-center gap-3">
						<input
							type="checkbox"
							checked={
								selectedChats.size === filteredChats.length &&
								filteredChats.length > 0
							}
							onChange={handleSelectAll}
							className="w-4 h-4 rounded border-white/30 bg-transparent"
						/>
						<span className="text-sm text-gray-400">
							{selectedChats.size > 0
								? `${selectedChats.size} selected`
								: 'Select all'}
						</span>
					</div>
					<span className="text-xs text-gray-500">
						⌘A select all • ⌘M move • Esc cancel
					</span>
				</div>
			)}

			<div className="space-y-2">
				{isLoadingChats ? (
					<div className="flex flex-col items-center justify-center py-12">
						<div className="w-10 h-10 rounded-full bg-white/5 animate-pulse mb-3" />
						<p className="text-gray-400 text-sm">Loading chats...</p>
					</div>
				) : filteredChats.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<MessageSquare className="w-12 h-12 text-gray-500 mb-3" />
						<p className="text-gray-400 text-sm">
							{chatSearch
								? `No chats matching "${chatSearch}"`
								: 'No chats in this folder'}
						</p>
					</div>
				) : (
					filteredChats.map((chat) => {
						const chatActions = getChatActions(chat)
						const chatRow = (
							<div
								className={`group flex items-center gap-3 p-4 rounded-[12px] transition-all ${
									selectedChats.has(chat.id)
										? 'bg-primary/10 border border-primary/30'
										: 'bg-white/[0.03] hover:bg-white/[0.06] border border-transparent'
								}`}
							>
								{isSelectMode && (
									<input
										type="checkbox"
										checked={selectedChats.has(chat.id)}
										onChange={() => toggleChatSelection(chat.id)}
										className="w-4 h-4 rounded border-white/30 bg-transparent flex-shrink-0"
									/>
								)}

								<MessageSquare className="w-5 h-5 text-gray-500 flex-shrink-0" />

								<div className="flex-1 min-w-0">
									<h4 className="text-white text-sm font-medium truncate">
										{chat.title}
									</h4>
									<div className="flex items-center gap-2 text-xs text-gray-500">
										<span>{chat.messageCount} messages</span>
										<span>•</span>
										<span>{formatRelativeTime(chat.updatedAt)}</span>
									</div>
								</div>

								{!isSelectMode && (
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 hover:bg-white/10"
													aria-label={`More actions for ${chat.title}`}
												>
													<MoreVertical className="w-4 h-4 text-gray-400" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="end"
												className={MENU_CONTENT_CLASSNAME}
											>
												{renderMenuActions('dropdown', chatActions)}
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								)}
							</div>
						)

						if (isSelectMode) {
							return <div key={chat.id}>{chatRow}</div>
						}

						return (
							<ContextMenu key={chat.id}>
								<ContextMenuTrigger asChild>{chatRow}</ContextMenuTrigger>
								<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
									{renderMenuActions('context', chatActions)}
								</ContextMenuContent>
							</ContextMenu>
						)
					})
				)}
			</div>

			{folderPagination && folderPagination.totalPages > 1 && (
				<div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-xs text-gray-500">
						Page {folderPagination.page} of {folderPagination.totalPages} •{' '}
						{totalFolderChats} chat{totalFolderChats !== 1 ? 's' : ''}
					</p>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								setFolderPage((current) => Math.max(1, current - 1))
							}
							disabled={folderPage === 1}
							className="border-white/20 text-white hover:bg-white/10"
						>
							<ChevronLeft className="mr-2 h-4 w-4" />
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								setFolderPage((current) =>
									Math.min(folderPagination.totalPages, current + 1)
								)
							}
							disabled={!folderPagination.hasMore}
							className="border-white/20 text-white hover:bg-white/10"
						>
							Next
							<ChevronRight className="ml-2 h-4 w-4" />
						</Button>
					</div>
				</div>
			)}

			{isSelectMode && selectedChats.size > 0 && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 bg-popover border border-primary/30 rounded-xl shadow-2xl z-50">
					<span className="text-white font-medium">
						{selectedChats.size} chat{selectedChats.size !== 1 ? 's' : ''}{' '}
						selected
					</span>
					<div className="w-px h-6 bg-white/20" />
					<Button
						size="sm"
						onClick={() => setShowMoveDialog(true)}
						className="bg-[#57FCFF] text-black hover:bg-[#57FCFF]/80"
					>
						<Folder className="w-4 h-4 mr-2" />
						Move
					</Button>
					<Button
						size="sm"
						variant="destructive"
						onClick={() => handleDeleteChats(Array.from(selectedChats))}
					>
						<Trash2 className="w-4 h-4 mr-2" />
						Delete
					</Button>
				</div>
			)}
		</>
	)

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent
					className={`bg-popover border border-primary/30 overflow-hidden transition-all duration-300 ${
						isExpanded
							? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh]'
							: 'max-w-[95vw] sm:max-w-[85vw] lg:max-w-[1041px] max-h-[90vh]'
					}`}
				>
					<DialogHeader className="px-6 pt-6 pb-4 flex flex-row items-center justify-between">
						<div className="flex min-w-0 flex-1 items-start justify-between gap-4">
							<div className="min-w-0">
								<DialogTitle className="text-[32px] font-bold text-white">
									{inspectingFolder ? inspectingFolder.name : 'Folders'}
								</DialogTitle>
								<DialogDescription className="text-sm text-gray-400">
									Manage folders and organize chats across pages.
								</DialogDescription>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsExpanded(!isExpanded)}
								className="h-8 w-8 p-0 hover:bg-white/10"
							>
								{isExpanded ? (
									<Shrink className="w-4 h-4 text-gray-400" />
								) : (
									<Expand className="w-4 h-4 text-gray-400" />
								)}
							</Button>
						</div>
					</DialogHeader>

					<div
						className={`px-6 pb-6 space-y-6 overflow-y-auto ${isExpanded ? 'max-h-[calc(95vh-100px)]' : 'max-h-[calc(90vh-120px)]'}`}
					>
						{inspectingFolder ? renderFolderInspection() : renderFolderGrid()}
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Folder Confirmation */}
			<AlertDialog
				open={!!deleteConfirm}
				onOpenChange={() => setDeleteConfirm(null)}
			>
				<AlertDialogContent className="bg-popover border border-primary/30">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-white">
							Delete Folder
						</AlertDialogTitle>
						<AlertDialogDescription className="text-gray-400">
							Are you sure you want to delete{' '}
							<span className="text-white font-semibold">
								"{deleteConfirm?.name}"
							</span>
							? All conversations will be moved to Uncategorized.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDeleteFolder}
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Delete Chat(s) Confirmation */}
			<AlertDialog
				open={!!deleteChatConfirm}
				onOpenChange={() => setDeleteChatConfirm(null)}
			>
				<AlertDialogContent className="bg-popover border border-primary/30">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-white">
							Delete Chat{deleteChatConfirm?.count !== 1 ? 's' : ''}
						</AlertDialogTitle>
						<AlertDialogDescription className="text-gray-400">
							Are you sure you want to delete{' '}
							{deleteChatConfirm?.count === 1
								? 'this chat'
								: `${deleteChatConfirm?.count} chats`}
							? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDeleteChats}
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Move to Folder Dialog */}
			<Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
				<DialogContent className="bg-popover border border-primary/30 sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-white">Move to Folder</DialogTitle>
						<DialogDescription className="text-gray-400">
							Choose where to move the selected chats.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
						<button
							onClick={() => handleMoveChats(null)}
							disabled={inspectingFolder?.id === null}
							className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<FolderOpen className="w-5 h-5 text-gray-500" />
							<span className="text-white">Uncategorized</span>
							{inspectingFolder?.id === null && (
								<span className="ml-auto text-xs text-gray-500">(current)</span>
							)}
						</button>

						{collections?.map((folder) => (
							<button
								key={folder.id}
								onClick={() => handleMoveChats(folder.id)}
								disabled={folder.id === inspectingFolder?.id}
								className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Folder className="w-5 h-5" style={{ color: folder.color }} />
								<span className="text-white">{folder.name}</span>
								{folder.id === inspectingFolder?.id && (
									<span className="ml-auto text-xs text-gray-500">
										(current)
									</span>
								)}
							</button>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
