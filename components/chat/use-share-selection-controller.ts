'use client'

import type { Message } from '@/hooks/use-chat'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseShareSelectionControllerOptions {
	displayedMessages: Message[]
	isAuthenticated: boolean
}

export function useShareSelectionController({
	displayedMessages,
	isAuthenticated,
}: UseShareSelectionControllerOptions) {
	const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
		new Set()
	)
	const [showSignInModal, setShowSignInModal] = useState(false)
	const [showSelectiveShareModal, setShowSelectiveShareModal] = useState(false)
	const [shareModalMessageIds, setShareModalMessageIds] = useState<string[]>([])

	const visibleShareableMessageIds = useMemo(
		() =>
			displayedMessages
				.filter(
					(message) => message.role === 'user' || message.role === 'assistant'
				)
				.map((message) => message.id),
		[displayedMessages]
	)
	const visibleShareableMessageIdsRef = useRef<string[]>(
		visibleShareableMessageIds
	)

	useEffect(() => {
		visibleShareableMessageIdsRef.current = visibleShareableMessageIds
	}, [visibleShareableMessageIds])

	const handleToggleMessageSelection = useCallback((messageId: string) => {
		setSelectedMessageIds((current) => {
			const next = new Set(current)
			if (next.has(messageId)) next.delete(messageId)
			else next.add(messageId)
			return next
		})
	}, [])

	const handleSelectAllMessages = useCallback(() => {
		setSelectedMessageIds(new Set(visibleShareableMessageIdsRef.current))
	}, [])

	const handleDeselectAllMessages = useCallback(() => {
		setSelectedMessageIds(new Set())
	}, [])

	const openSelectiveShare = useCallback(
		(messageIds: string[]) => {
			if (!isAuthenticated) {
				setShowSignInModal(true)
				return
			}

			if (messageIds.length === 0) return

			setShareModalMessageIds(messageIds)
			setShowSelectiveShareModal(true)
		},
		[isAuthenticated]
	)

	const handleShareMessages = useCallback(
		(messageIds: string[]) => {
			openSelectiveShare(messageIds)
		},
		[openSelectiveShare]
	)

	const handleShareCurrentView = useCallback(() => {
		const idsToShare =
			selectedMessageIds.size > 0
				? Array.from(selectedMessageIds)
				: visibleShareableMessageIds

		openSelectiveShare(idsToShare)
	}, [openSelectiveShare, selectedMessageIds, visibleShareableMessageIds])

	const handleAutoCompletePairs = useCallback((messageIds: string[]) => {
		setSelectedMessageIds((current) => {
			const next = new Set(current)
			messageIds.forEach((id) => next.add(id))
			return next
		})
		setShareModalMessageIds((current) => {
			const next = new Set([...current, ...messageIds])
			return Array.from(next)
		})
	}, [])

	return {
		selectedMessageIds,
		setSelectedMessageIds,
		showSignInModal,
		setShowSignInModal,
		showSelectiveShareModal,
		setShowSelectiveShareModal,
		shareModalMessageIds,
		handleToggleMessageSelection,
		handleSelectAllMessages,
		handleDeselectAllMessages,
		handleShareMessages,
		handleShareCurrentView,
		handleAutoCompletePairs,
	}
}
