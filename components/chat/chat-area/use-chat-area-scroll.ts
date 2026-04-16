'use client'

import { type Message } from '@/hooks/use-chat'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useChatAreaScroll(messages: Message[]) {
	const messageCount = messages.length
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messagesContainerRef = useRef<HTMLDivElement>(null)
	const messageCountRef = useRef(messageCount)
	const scrollFrameRef = useRef<number | null>(null)
	const [isNearBottom, setIsNearBottom] = useState(true)
	const [showScrollButton, setShowScrollButton] = useState(false)
	const [activeMessageId, setActiveMessageId] = useState<string | null>(null)

	useEffect(() => {
		messageCountRef.current = messageCount
	}, [messageCount])

	const checkScrollPosition = useCallback(() => {
		const container = messagesContainerRef.current
		if (!container) return

		const threshold = 100
		const isNear =
			container.scrollHeight - container.scrollTop - container.clientHeight <
			threshold
		const shouldShowButton = !isNear && messageCountRef.current > 0

		setIsNearBottom((currentIsNearBottom) =>
			currentIsNearBottom === isNear ? currentIsNearBottom : isNear
		)
		setShowScrollButton((currentShowScrollButton) =>
			currentShowScrollButton === shouldShowButton
				? currentShowScrollButton
				: shouldShowButton
		)
	}, [])

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
		if (isNearBottom && messageCount > 0) {
			scrollToBottom('smooth')
		}
	}, [isNearBottom, messageCount, scrollToBottom])

	useEffect(() => {
		if (messageCount === 0) {
			setShowScrollButton(false)
		}
	}, [messageCount])

	useEffect(() => {
		const container = messagesContainerRef.current
		if (!container) return

		const handleScroll = () => {
			if (scrollFrameRef.current !== null) {
				return
			}

			scrollFrameRef.current = window.requestAnimationFrame(() => {
				scrollFrameRef.current = null
				checkScrollPosition()
			})
		}

		container.addEventListener('scroll', handleScroll)
		checkScrollPosition()

		return () => {
			container.removeEventListener('scroll', handleScroll)
			if (scrollFrameRef.current !== null) {
				window.cancelAnimationFrame(scrollFrameRef.current)
				scrollFrameRef.current = null
			}
		}
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
