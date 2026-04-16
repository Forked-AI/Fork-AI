'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

interface UseConversationLoaderOptions {
	conversationId: string | null
	loadConversation: (conversationId: string) => Promise<void>
	clearMessages: () => void
	isStreaming: boolean
	suppressLoadConversationId?: string | null
}

export function useConversationLoader({
	conversationId,
	loadConversation,
	clearMessages,
	isStreaming,
	suppressLoadConversationId = null,
}: UseConversationLoaderOptions) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const hasHandledLegacyFallbackRef = useRef(false)
	const selectedConversationId = searchParams.get('c')
	const previousSelectedConversationIdRef = useRef<string | null>(
		selectedConversationId
	)
	const pendingClearAfterStreamRef = useRef(false)

	useEffect(() => {
		const previousSelectedConversationId =
			previousSelectedConversationIdRef.current
		previousSelectedConversationIdRef.current = selectedConversationId

		if (selectedConversationId) {
			pendingClearAfterStreamRef.current = false
			if (
				isStreaming &&
				suppressLoadConversationId &&
				selectedConversationId === suppressLoadConversationId
			) {
				return
			}

			if (selectedConversationId !== conversationId) {
				void loadConversation(selectedConversationId)
			}
			return
		}

		if (!hasHandledLegacyFallbackRef.current) {
			hasHandledLegacyFallbackRef.current = true

			const selectedChatData = sessionStorage.getItem('selectedChat')
			if (selectedChatData) {
				try {
					const chat = JSON.parse(selectedChatData) as { id?: string }
					if (chat.id && chat.id.length > 10) {
						pendingClearAfterStreamRef.current = false
						router.replace(`/chat?c=${chat.id}`, { scroll: false })
						return
					}
				} catch (error) {
					console.error('Failed to load chat:', error)
				}

				sessionStorage.removeItem('selectedChat')
			}
		}

		if (
			suppressLoadConversationId &&
			conversationId === suppressLoadConversationId
		) {
			return
		}

		const navigatedFromConversationToNewChat =
			previousSelectedConversationId !== null && !selectedConversationId

		if (navigatedFromConversationToNewChat) {
			if (isStreaming) {
				pendingClearAfterStreamRef.current = true
				return
			}

			pendingClearAfterStreamRef.current = false
			if (conversationId) {
				clearMessages()
			}
			return
		}

		if (pendingClearAfterStreamRef.current && !isStreaming && conversationId) {
			pendingClearAfterStreamRef.current = false
			clearMessages()
		}
	}, [
		clearMessages,
		conversationId,
		isStreaming,
		loadConversation,
		router,
		selectedConversationId,
		suppressLoadConversationId,
	])

	return { selectedConversationId }
}
