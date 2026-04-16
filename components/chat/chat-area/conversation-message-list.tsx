'use client'

import { EmptyState } from '@/components/chat/empty-state'
import { type Message } from '@/hooks/use-chat'
import type { MutableRefObject, RefObject } from 'react'
import { MessageBubble } from './message-bubble'

interface SiblingNav {
	currentIndex: number
	totalCount: number
	onPrevious: () => void
	onNext: () => void
	disabled?: boolean
}

interface ConversationMessageListProps {
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
}

export function ConversationMessageList({
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
}: ConversationMessageListProps) {
	return (
		<div
			ref={messagesContainerRef}
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
