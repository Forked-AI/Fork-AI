'use client'

import type { MenuAction } from '@/components/chat/menu-action-renderer'
import {
	useCollections,
	useCreateCollection,
	useDeleteCollection,
	useUpdateCollection,
} from '@/hooks/use-collections'
import { useConversations } from '@/hooks/use-conversations'
import { useToast } from '@/hooks/use-toast'
import {
	Edit2,
	Folder,
	FolderOpen,
	MessageSquare,
	Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const PRESET_COLORS = [
	'#57FCFF',
	'#FF6B9D',
	'#FFD93D',
	'#9B59B6',
	'#2ECC71',
	'#E67E22',
	'#95A5A6',
	'#E74C3C',
] as const

const FOLDER_PAGE_SIZE = 100
const BATCH_REQUEST_CONCURRENCY = 4

async function runBatchedRequests<T>(
	items: readonly T[],
	worker: (item: T) => Promise<void>,
	concurrency: number = BATCH_REQUEST_CONCURRENCY
) {
	if (items.length === 0) return

	const workerCount = Math.max(1, Math.min(concurrency, items.length))
	let cursor = 0
	let firstError: unknown = null

	const runWorker = async () => {
		while (!firstError) {
			const index = cursor
			cursor += 1

			if (index >= items.length) {
				return
			}

			try {
				await worker(items[index])
			} catch (error) {
				firstError = error
				return
			}
		}
	}

	await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

	if (firstError) {
		throw firstError
	}
}

export type DateFilter = 'all' | 'today' | 'week' | 'month' | 'older'
export type SortOrder = 'recent' | 'oldest' | 'alphabetical'

export interface InspectingFolder {
	id: string | null
	name: string
	color: string
}

function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message.trim()) {
		return error.message
	}

	return fallback
}

export function useCollectionsModalController({
	open,
	onOpenChange,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const router = useRouter()
	const { toast } = useToast()
	const { data: collections, isLoading, error } = useCollections()
	const createCollection = useCreateCollection()
	const updateCollection = useUpdateCollection()
	const deleteCollection = useDeleteCollection()

	const [newCollectionName, setNewCollectionName] = useState('')
	const [selectedColor, setSelectedColor] = useState<string>(PRESET_COLORS[0])
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState('')
	const [deleteConfirm, setDeleteConfirm] = useState<{
		id: string
		name: string
	} | null>(null)
	const [inspectingFolder, setInspectingFolder] =
		useState<InspectingFolder | null>(null)
	const [folderSearch, setFolderSearch] = useState('')
	const [chatSearch, setChatSearch] = useState('')
	const [folderPage, setFolderPage] = useState(1)
	const [dateFilter, setDateFilter] = useState<DateFilter>('all')
	const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
	const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set())
	const [isSelectMode, setIsSelectMode] = useState(false)
	const [isExpanded, setIsExpanded] = useState(false)
	const [showMoveDialog, setShowMoveDialog] = useState(false)
	const [deleteChatConfirm, setDeleteChatConfirm] = useState<{
		ids: string[]
		count: number
	} | null>(null)

	const {
		conversations: folderChats,
		pagination: folderPagination,
		isLoading: isLoadingChats,
		updateConversation,
		deleteConversation,
	} = useConversations({
		page: folderPage,
		collectionId: inspectingFolder?.id,
		search: chatSearch,
		limit: FOLDER_PAGE_SIZE,
		enabled: inspectingFolder !== null,
	})

	const { pagination: uncategorizedPagination } = useConversations({
		page: 1,
		collectionId: null,
		limit: FOLDER_PAGE_SIZE,
		enabled: open && !inspectingFolder,
	})

	const totalFolderChats = folderPagination?.total ?? 0
	const uncategorizedCount = uncategorizedPagination?.total ?? 0
	const uncategorizedFolder: InspectingFolder = useMemo(
		() => ({
			id: null,
			name: 'Uncategorized',
			color: '#6B7280',
		}),
		[]
	)

	const getFolderDestinationName = useCallback(
		(folderId: string | null) => {
			if (folderId === null) return 'Uncategorized'

			return (
				collections?.find((folder) => folder.id === folderId)?.name ??
				'selected folder'
			)
		},
		[collections]
	)

	const filteredFolders = useMemo(() => {
		if (!collections) return []
		if (!folderSearch.trim()) return collections
		const term = folderSearch.toLowerCase()
		return collections.filter((collection) =>
			collection.name.toLowerCase().includes(term)
		)
	}, [collections, folderSearch])

	const filteredChats = useMemo(() => {
		let chats = [...(folderChats ?? [])]

		const now = new Date()
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
		const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
		const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

		if (dateFilter !== 'all') {
			chats = chats.filter((chat) => {
				const chatDate = new Date(chat.updatedAt)
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
				break
		}

		return chats
	}, [dateFilter, folderChats, sortOrder])

	useEffect(() => {
		if (!open) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!inspectingFolder) return

			if ((event.ctrlKey || event.metaKey) && event.key === 'a' && isSelectMode) {
				event.preventDefault()
				setSelectedChats(new Set(filteredChats.map((chat) => chat.id)))
			}

			if (
				(event.ctrlKey || event.metaKey) &&
				event.key === 'm' &&
				selectedChats.size > 0
			) {
				event.preventDefault()
				setShowMoveDialog(true)
			}

			if (event.key === 'Escape') {
				if (selectedChats.size > 0) {
					setSelectedChats(new Set())
				} else if (isSelectMode) {
					setIsSelectMode(false)
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [filteredChats, inspectingFolder, isSelectMode, open, selectedChats])

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

	const handleCreate = useCallback(async () => {
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
	}, [createCollection, newCollectionName, selectedColor, toast])

	const handleStartEdit = useCallback((id: string, name: string) => {
		setEditingId(id)
		setEditingName(name)
	}, [])

	const handleSaveEdit = useCallback(
		async (id: string) => {
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
		},
		[collections, editingName, toast, updateCollection]
	)

	const handleCancelEdit = useCallback(() => {
		setEditingId(null)
		setEditingName('')
	}, [])

	const handleDeleteFolder = useCallback(
		(id: string, isDefault: boolean, name: string) => {
			if (isDefault) return
			setDeleteConfirm({ id, name })
		},
		[]
	)

	const confirmDeleteFolder = useCallback(async () => {
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
	}, [deleteCollection, deleteConfirm, inspectingFolder?.id, toast])

	const handleFolderClick = useCallback((folder: InspectingFolder) => {
		setFolderPage(1)
		setInspectingFolder(folder)
		setChatSearch('')
		setSelectedChats(new Set())
		setIsSelectMode(false)
	}, [])

	const handleBackToFolders = useCallback(() => {
		setFolderPage(1)
		setInspectingFolder(null)
		setChatSearch('')
		setSelectedChats(new Set())
		setIsSelectMode(false)
	}, [])

	const toggleChatSelection = useCallback((chatId: string) => {
		setSelectedChats((current) => {
			const next = new Set(current)
			if (next.has(chatId)) {
				next.delete(chatId)
			} else {
				next.add(chatId)
			}
			return next
		})
	}, [])

	const handleSelectAll = useCallback(() => {
		if (selectedChats.size === filteredChats.length) {
			setSelectedChats(new Set())
		} else {
			setSelectedChats(new Set(filteredChats.map((chat) => chat.id)))
		}
	}, [filteredChats, selectedChats.size])

	const handleMoveChats = useCallback(
		async (targetFolderId: string | null) => {
			const chatIdsToMove = Array.from(selectedChats).filter((chatId) => {
				const currentFolderId =
					filteredChats.find((chat) => chat.id === chatId)?.collection?.id ?? null
				return currentFolderId !== targetFolderId
			})
			if (chatIdsToMove.length === 0) return

			const movedCount = chatIdsToMove.length
			const destinationName = getFolderDestinationName(targetFolderId)
			try {
				await runBatchedRequests(chatIdsToMove, async (chatId) => {
					await updateConversation({ id: chatId, collectionId: targetFolderId })
				})
				setSelectedChats(new Set())
				setIsSelectMode(false)
				setShowMoveDialog(false)
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
		},
		[
			filteredChats,
			getFolderDestinationName,
			selectedChats,
			toast,
			updateConversation,
		]
	)

	const handleMoveSingleChat = useCallback(
		async (chatId: string, targetFolderId: string | null) => {
			const currentFolderId =
				filteredChats.find((chat) => chat.id === chatId)?.collection?.id ?? null
			if (currentFolderId === targetFolderId) return

			const destinationName = getFolderDestinationName(targetFolderId)
			try {
				await updateConversation({ id: chatId, collectionId: targetFolderId })
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
		},
		[filteredChats, getFolderDestinationName, toast, updateConversation]
	)

	const handleOpenChat = useCallback(
		(chatId: string) => {
			router.replace(`/chat?c=${chatId}`, { scroll: false })
			onOpenChange(false)
		},
		[onOpenChange, router]
	)

	const handleDeleteChats = useCallback((chatIds: string[]) => {
		setDeleteChatConfirm({ ids: chatIds, count: chatIds.length })
	}, [])

	const confirmDeleteChats = useCallback(async () => {
		if (!deleteChatConfirm) return
		const deletedCount = deleteChatConfirm.count

		try {
			await runBatchedRequests(deleteChatConfirm.ids, async (id) => {
				await deleteConversation(id)
			})
			setSelectedChats(new Set())
			setDeleteChatConfirm(null)
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
	}, [deleteChatConfirm, deleteConversation, toast])

	const toggleSelectMode = useCallback(() => {
		setIsSelectMode((current) => {
			if (current) {
				setSelectedChats(new Set())
			}
			return !current
		})
	}, [])

	const getFolderActions = useCallback(
		(folder: InspectingFolder & { isDefault?: boolean }): MenuAction[] => {
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

			if (folder.id === null) return actions
			const folderId = folder.id

			actions.push({
				type: 'item',
				key: 'rename',
				label: 'Rename',
				icon: Edit2,
				onSelect: () => handleStartEdit(folderId, folder.name),
			})

			if (!folder.isDefault) {
				actions.push({
					type: 'item',
					key: 'delete',
					label: 'Delete',
					icon: Trash2,
					onSelect: () => handleDeleteFolder(folderId, false, folder.name),
					variant: 'destructive',
				})
			}

			return actions
		},
		[handleDeleteFolder, handleFolderClick, handleStartEdit]
	)

	const getChatActions = useCallback(
		(chat: { id: string; title: string }): MenuAction[] => [
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
		],
		[collections, handleDeleteChats, handleMoveSingleChat, handleOpenChat, inspectingFolder?.id]
	)

	const formatRelativeTime = useCallback((dateString: string) => {
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
	}, [])

	return {
		collections,
		isLoadingCollections: isLoading,
		collectionsError: error,
		createCollection,
		updateCollection,
		deleteCollection,
		newCollectionName,
		setNewCollectionName,
		selectedColor,
		setSelectedColor,
		presetColors: PRESET_COLORS,
		editingId,
		editingName,
		setEditingName,
		deleteConfirm,
		setDeleteConfirm,
		confirmDeleteFolder,
		inspectingFolder,
		folderSearch,
		setFolderSearch,
		chatSearch,
		setChatSearch,
		folderPage,
		setFolderPage,
		dateFilter,
		setDateFilter,
		sortOrder,
		setSortOrder,
		selectedChats,
		isSelectMode,
		isExpanded,
		setIsExpanded,
		showMoveDialog,
		setShowMoveDialog,
		deleteChatConfirm,
		setDeleteChatConfirm,
		folderChats,
		folderPagination,
		isLoadingChats,
		totalFolderChats,
		uncategorizedCount,
		uncategorizedFolder,
		filteredFolders,
		filteredChats,
		handleCreate,
		handleStartEdit,
		handleSaveEdit,
		handleCancelEdit,
		handleDeleteFolder,
		handleFolderClick,
		handleBackToFolders,
		toggleChatSelection,
		handleSelectAll,
		handleMoveChats,
		handleMoveSingleChat,
		handleOpenChat,
		handleDeleteChats,
		confirmDeleteChats,
		toggleSelectMode,
		getFolderActions,
		getChatActions,
		formatRelativeTime,
	}
}
