'use client'

import { useToast } from '@/hooks/use-toast'
import type { Collection } from '@/hooks/use-collections'
import type { Message } from '@/hooks/use-chat'
import type { ConversationPreview } from '@/hooks/use-conversations'
import type { MenuAction } from '@/components/chat/menu-action-renderer'
import {
	Edit2,
	Folder,
	FolderOpen,
	Loader2,
	MessageSquare,
	Pin,
	PinOff,
	Share2,
	Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export interface ShareDialogState {
	conversationId: string
	conversationTitle: string
	selectedMessageIds: string[]
	allMessages: Message[]
}

export type ConversationMenuSurface = 'dropdown' | 'context'

function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message.trim()) {
		return error.message
	}

	return fallback
}

interface UseSidebarConversationActionsOptions {
	activeItem: string | null
	collections: Collection[] | undefined
	deleteConversation: (conversationId: string) => Promise<unknown>
	handleChatClick: (conversationId: string) => void
	handleNewChat: () => void
	invalidateConversations: () => void
	isDeleting: boolean
	updateConversation: (input: {
		id: string
		title?: string
		collectionId?: string | null
		isPinned?: boolean
	}) => Promise<unknown>
}

export function useSidebarConversationActions({
	activeItem,
	collections,
	deleteConversation,
	handleChatClick,
	handleNewChat,
	invalidateConversations,
	isDeleting,
	updateConversation,
}: UseSidebarConversationActionsOptions) {
	const { toast } = useToast()
	const [renameDialog, setRenameDialog] = useState<{
		id: string
		title: string
	} | null>(null)
	const [renameTitle, setRenameTitle] = useState('')
	const [shareDialog, setShareDialog] = useState<ShareDialogState | null>(null)
	const [shareLoadingId, setShareLoadingId] = useState<string | null>(null)
	const [openConversationMenu, setOpenConversationMenu] = useState<{
		id: string
		surface: ConversationMenuSurface
	} | null>(null)

	const isRenameUnchanged = useMemo(
		() =>
			renameDialog ? renameTitle.trim() === renameDialog.title.trim() : false,
		[renameDialog, renameTitle]
	)

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

	const handleAutoCompleteSharePairs = useCallback((messageIds: string[]) => {
		setShareDialog((current) => {
			if (!current) return current
			return {
				...current,
				selectedMessageIds: Array.from(
					new Set([...current.selectedMessageIds, ...messageIds])
				),
			}
		})
	}, [])

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
					...(collections?.map((collection) => ({
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

	return {
		renameDialog,
		renameTitle,
		setRenameTitle,
		isRenameUnchanged,
		closeRenameDialog,
		handleSaveRename,
		shareDialog,
		setShareDialog,
		shareLoadingId,
		openConversationMenu,
		getConversationActions,
		handleConversationMenuOpenChange,
		handleAutoCompleteSharePairs,
		invalidateConversations,
	}
}
