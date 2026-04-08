'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

interface UseConversationLoaderOptions {
	conversationId: string | null
	loadConversation: (conversationId: string) => Promise<void>
	clearMessages: () => void
}

export function useConversationLoader({
	conversationId,
	loadConversation,
	clearMessages,
}: UseConversationLoaderOptions) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const hasHandledLegacyFallbackRef = useRef(false)
	const selectedConversationId = searchParams.get('c')

	useEffect(() => {
		if (selectedConversationId) {
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
						router.replace(`/chat?c=${chat.id}`, { scroll: false })
						return
					}
				} catch (error) {
					console.error('Failed to load chat:', error)
				}

				sessionStorage.removeItem('selectedChat')
			}
		}

		if (conversationId) {
			clearMessages()
		}
	}, [clearMessages, conversationId, loadConversation, router, selectedConversationId])

	return { selectedConversationId }
}
