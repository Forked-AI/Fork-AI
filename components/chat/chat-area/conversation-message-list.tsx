'use client'

import { EmptyState } from '@/components/chat/empty-state'
import { type Message } from '@/hooks/use-chat'
import type {
	MouseEvent as ReactMouseEvent,
	MutableRefObject,
	RefObject,
	TouchEvent as ReactTouchEvent,
} from 'react'
import { MessageBubble } from './message-bubble'

interface SiblingNav {
	currentIndex: number
	totalCount: number
	onPrevious: () => void
	onNext: () => void
	disabled?: boolean
}

interface ConversationMessageListProps {
	conversationId?: string | null
	displayedMessages: Message[]
	messagesContainerRef: RefObject<HTMLDivElement | null>
	messagesEndRef: RefObject<HTMLDivElement | null>
	isStreaming: boolean
	getSiblingNav: (message: Message) => SiblingNav | undefined
	activeMessageId: string | null
	selectedMessageIds: Set<string>
	onToggleMessageSelection: (messageId: string) => void
	onRetry: (messageId: string) => void
	onStop: () => void
	onEdit: (messageId: string, newContent: string) => void
	onEditParent: (messageId: string) => void
	editHandlersRef: MutableRefObject<Map<string, () => void>>
	disableMutatingActions?: boolean
	onQuoteSelection?: (selection: {
		messageId: string
		text: string
		rect: DOMRect
	}) => void
	onScroll?: () => void
}

function getElementFromNode(node: Node | null): Element | null {
	if (!node) return null
	return node.nodeType === Node.ELEMENT_NODE
		? (node as Element)
		: node.parentElement
}

function getRangeRect(range: Range): DOMRect | null {
	const rect = range.getBoundingClientRect()
	if (rect.width > 0 || rect.height > 0) {
		return rect
	}

	return range.getClientRects()[0] ?? null
}

function readQuoteSelection(
	container: HTMLElement
): { messageId: string; text: string; rect: DOMRect } | null {
	const selection = window.getSelection()
	const text = selection?.toString().trim()

	if (!selection || !text || selection.rangeCount === 0) {
		return null
	}

	const range = selection.getRangeAt(0)
	const commonElement = getElementFromNode(range.commonAncestorContainer)
	const messageContent = commonElement?.closest<HTMLElement>(
		'[data-message-content="true"]'
	)

	if (!messageContent || !container.contains(messageContent)) {
		return null
	}

	if (messageContent.dataset.selectionDisabled === 'true') {
		return null
	}

	if (
		commonElement?.closest(
			'button, input, select, textarea, [data-quote-selection-ignore="true"]'
		)
	) {
		return null
	}

	const messageId = messageContent.dataset.messageId
	const rect = getRangeRect(range)

	if (!messageId || !rect) {
		return null
	}

	return { messageId, text, rect }
}

export function ConversationMessageList({
	conversationId = null,
	displayedMessages,
	messagesContainerRef,
	messagesEndRef,
	isStreaming,
	getSiblingNav,
	activeMessageId,
	selectedMessageIds,
	onToggleMessageSelection,
	onRetry,
	onStop,
	onEdit,
	onEditParent,
	editHandlersRef,
	disableMutatingActions = false,
	onQuoteSelection,
	onScroll,
}: ConversationMessageListProps) {
	const handlePotentialQuoteSelection = (
		event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>
	) => {
		if (!onQuoteSelection || disableMutatingActions) {
			return
		}

		const target = event.target
		if (
			target instanceof Element &&
			target.closest(
				'button, input, select, textarea, [data-quote-selection-ignore="true"]'
			)
		) {
			return
		}

		const container = event.currentTarget
		window.setTimeout(() => {
			const quoteSelection = readQuoteSelection(container)
			if (quoteSelection) {
				onQuoteSelection(quoteSelection)
			}
		}, 0)
	}

	return (
		<div
			ref={messagesContainerRef}
			onMouseUp={handlePotentialQuoteSelection}
			onTouchEnd={handlePotentialQuoteSelection}
			onScroll={onScroll}
			className="relative flex-1 overflow-y-auto w-full"
		>
			{displayedMessages.length > 0 ? (
				<div className="mx-auto max-w-4xl space-y-6 px-12 py-8">
					{displayedMessages.map((message) => (
						<MessageBubble
							key={message.id}
							message={message}
							onRetry={onRetry}
							onStop={onStop}
							onEdit={onEdit}
							isStreaming={isStreaming}
							siblingNav={getSiblingNav(message)}
							isActive={activeMessageId === message.id}
							isSelected={selectedMessageIds.has(message.id)}
							onToggleSelection={() => onToggleMessageSelection(message.id)}
							onEditParent={onEditParent}
							editHandlersRef={editHandlersRef}
							disableMutatingActions={disableMutatingActions}
							conversationId={conversationId}
						/>
					))}
					<div ref={messagesEndRef} />
				</div>
			) : (
				<div className="mx-auto flex h-full max-w-3xl items-center justify-center px-6">
					<EmptyState />
				</div>
			)}
		</div>
	)
}
