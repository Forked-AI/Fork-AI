'use client'

import { type Message } from '@/hooks/use-chat'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useChatAreaScroll(messages: Message[]) {
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messagesContainerRef = useRef<HTMLDivElement>(null)
	const [isNearBottom, setIsNearBottom] = useState(true)
	const [showScrollButton, setShowScrollButton] = useState(false)
	const [activeMessageId, setActiveMessageId] = useState<string | null>(null)

	const checkScrollPosition = useCallback(() => {
		const container = messagesContainerRef.current
		if (!container) return

		const threshold = 100
		const isNear =
			container.scrollHeight - container.scrollTop - container.clientHeight <
			threshold
		setIsNearBottom(isNear)
		setShowScrollButton(!isNear && messages.length > 0)
	}, [messages.length])

	const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
		messagesEndRef.current?.scrollIntoView({ behavior })
		setIsNearBottom(true)
		setShowScrollButton(false)
	}, [])

	const scrollToMessage = useCallback((messageId: string) => {
		const element = document.getElementById(`message-${messageId}`)
		if (!element) return

		element.scrollIntoView({ behavior: 'smooth', block: 'center' })
		setActiveMessageId(messageId)
		setTimeout(() => setActiveMessageId(null), 2000)
	}, [])

	useEffect(() => {
		if (isNearBottom) {
			scrollToBottom('smooth')
		}
	}, [isNearBottom, messages, scrollToBottom])

	useEffect(() => {
		const container = messagesContainerRef.current
		if (!container) return

		const handleScroll = () => {
			checkScrollPosition()
		}

		container.addEventListener('scroll', handleScroll)
		return () => container.removeEventListener('scroll', handleScroll)
	}, [checkScrollPosition])

	return {
		activeMessageId,
		messagesContainerRef,
		messagesEndRef,
		scrollToBottom,
		scrollToMessage,
		showScrollButton,
	}
}
