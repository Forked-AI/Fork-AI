'use client'

import { ConversationMessageList } from '@/components/chat/chat-area/conversation-message-list'
import { useChatAreaGraph } from '@/components/chat/chat-area/use-chat-area-graph'
import { useChatAreaScroll } from '@/components/chat/chat-area/use-chat-area-scroll'
import { useChatUI } from '@/components/chat/chat-ui-provider'
import { ConversationExportDialog } from '@/components/chat/conversation-export-dialog'
import { useConversationLoader } from '@/components/chat/use-conversation-loader'
import { useShareSelectionController } from '@/components/chat/use-share-selection-controller'
import { useAuth } from '@/contexts/auth-context'
import {
	buildLocalHistorySnapshot,
	useChat,
	type Message,
	type MessageHistoryEntry,
} from '@/hooks/use-chat'
import { useConversation, useConversations } from '@/hooks/use-conversations'
import { useMessageTree } from '@/hooks/use-message-tree'
import { useSettings } from '@/hooks/use-settings'
import { AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatInput } from './chat-input'
import { ChatTOC } from './ChatTOC'
import { SelectiveShareModal } from './selective-share-modal'
import { SignInPromptModal } from './sign-in-prompt-modal'
import { TopBar } from './top-bar'

const GraphMap = dynamic(() => import('./GraphMap'), { ssr: false })
const GraphInspector = dynamic(() => import('./GraphInspector'), { ssr: false })

type QueueStatus = 'idle' | 'running' | 'halted'

interface QueuedMessage {
	id: string
	content: string
	model: string
	createdAt: Date
}

export function ChatArea() {
	const router = useRouter()
	const { startTitleGeneration, finishTitleGeneration } = useChatUI()
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const editHandlersRef = useRef<Map<string, () => void>>(new Map())
	const messagesRef = useRef<Message[]>([])
	const previousIsStreamingRef = useRef(false)
	const selectedConversationIdRef = useRef<string | null>(null)
	const activeSendParentMessageIdRef = useRef<string | null>(null)
	const activeSendHistoryRef = useRef<MessageHistoryEntry[]>([])
	const queuedMessagesRef = useRef<QueuedMessage[]>([])
	const queueStatusRef = useRef<QueueStatus>('idle')
	const queueTailMessageIdRef = useRef<string | null>(null)
	const queueHistoryRef = useRef<MessageHistoryEntry[]>([])
	const tocMessagesSnapshotRef = useRef<Message[]>([])
	const isDrainingQueueRef = useRef(false)
	const [branchFromMessageId, setBranchFromMessageId] = useState<string | null>(
		null
	)
	const [pendingConversationId, setPendingConversationId] = useState<
		string | null
	>(null)
	const [showExportDialog, setShowExportDialog] = useState(false)
	const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([])
	const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle')

	const { user } = useAuth()
	const { settings } = useSettings()

	const { invalidateConversationList, generateTitle, updateConversation } =
		useConversations({
			enabled: false,
		})

	const {
		messages,
		isStreaming,
		error,
		conversationId,
		sendMessage,
		regenerate,
		editAndRegenerate,
		stopGeneration,
		clearMessages,
		loadConversation,
	} = useChat({
		systemPrompt: settings.systemPrompt,
		onConversationCreated: (id) => {
			setPendingConversationId(id)

			const params = new URLSearchParams(window.location.search)
			params.set('c', id)

			const nextSearch = params.toString()
			const nextUrl = `${window.location.pathname}${
				nextSearch ? `?${nextSearch}` : ''
			}${window.location.hash}`

			window.history.replaceState(window.history.state, '', nextUrl)
		},
		onTitleGenerationNeeded: async (id) => {
			startTitleGeneration(id)
			try {
				await generateTitle(id)
			} finally {
				finishTitleGeneration(id)
			}
		},
		onError: (err) => {
			console.error('Chat error:', err)
		},
	})

	const {
		getSiblings,
		getSiblingIndex,
		navigateSibling,
		getActivePath,
		getAncestorPath,
	} = useMessageTree(messages)

	const displayedMessages = useMemo(() => {
		if (branchFromMessageId) {
			return getAncestorPath(messages, branchFromMessageId)
		}
		return getActivePath(messages)
	}, [branchFromMessageId, getActivePath, getAncestorPath, messages])

	const tocMessages = useMemo(() => {
		if (!isStreaming || tocMessagesSnapshotRef.current.length === 0) {
			tocMessagesSnapshotRef.current = displayedMessages
		}

		return tocMessagesSnapshotRef.current
	}, [displayedMessages, isStreaming])

	messagesRef.current = messages

	const {
		selectedMessageIds,
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
	} = useShareSelectionController({
		displayedMessages,
		isAuthenticated: !!user,
	})

	const { selectedConversationId } = useConversationLoader({
		conversationId,
		loadConversation,
		clearMessages,
		isStreaming,
		suppressLoadConversationId: pendingConversationId,
	})

	const { data: conversation } = useConversation(conversationId)

	const {
		activeMessageId,
		messagesContainerRef,
		messagesEndRef,
		scrollToBottom,
		scrollToMessage,
		showScrollButton,
	} = useChatAreaScroll(messages)

	const setQueueStatusState = useCallback((nextStatus: QueueStatus) => {
		queueStatusRef.current = nextStatus
		setQueueStatus(nextStatus)
	}, [])

	const setQueuedMessagesState = useCallback(
		(
			updater:
				| QueuedMessage[]
				| ((currentQueuedMessages: QueuedMessage[]) => QueuedMessage[])
		) => {
			setQueuedMessages((currentQueuedMessages) => {
				const nextQueuedMessages =
					typeof updater === 'function'
						? updater(currentQueuedMessages)
						: updater
				queuedMessagesRef.current = nextQueuedMessages
				return nextQueuedMessages
			})
		},
		[]
	)

	const setQueueTailMessageId = useCallback((messageId: string | null) => {
		queueTailMessageIdRef.current = messageId
	}, [])

	const setQueueHistory = useCallback((history: MessageHistoryEntry[]) => {
		queueHistoryRef.current = history
	}, [])

	const clearQueuedState = useCallback(() => {
		setQueuedMessagesState([])
		setQueueStatusState('idle')
		setQueueTailMessageId(null)
		setQueueHistory([])
	}, [
		setQueueHistory,
		setQueueStatusState,
		setQueueTailMessageId,
		setQueuedMessagesState,
	])

	const enqueueMessage = useCallback(
		(
			content: string,
			model: string,
			anchorMessageId: string | null,
			anchorHistory: MessageHistoryEntry[]
		) => {
			const queuedMessage: QueuedMessage = {
				id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				content,
				model,
				createdAt: new Date(),
			}

			if (queueTailMessageIdRef.current === null) {
				setQueueTailMessageId(anchorMessageId)
			}

			if (queueHistoryRef.current.length === 0) {
				setQueueHistory(anchorHistory)
			}

			setQueuedMessagesState((currentQueuedMessages) => [
				...currentQueuedMessages,
				queuedMessage,
			])

			if (queueStatusRef.current !== 'halted') {
				setQueueStatusState('running')
			}

			return queuedMessage
		},
		[
			setQueueHistory,
			setQueueStatusState,
			setQueueTailMessageId,
			setQueuedMessagesState,
		]
	)

	const readHistorySnapshot = useCallback(
		async (parentMessageId: string | null) => {
			if (parentMessageId === null) {
				return queueHistoryRef.current
			}

			for (let attempt = 0; attempt < 5; attempt += 1) {
				const snapshot = buildLocalHistorySnapshot(
					messagesRef.current,
					parentMessageId
				)
				if (snapshot.length > 0) {
					return snapshot
				}

				await new Promise((resolve) => setTimeout(resolve, 0))
			}

			return buildLocalHistorySnapshot(messagesRef.current, parentMessageId)
		},
		[]
	)

	const drainQueuedMessages = useCallback(async () => {
		if (isDrainingQueueRef.current || queueStatusRef.current !== 'running') {
			return
		}

		isDrainingQueueRef.current = true

		try {
			while (
				queueStatusRef.current === 'running' &&
				queuedMessagesRef.current.length > 0
			) {
				const [nextQueuedMessage, ...remainingQueuedMessages] =
					queuedMessagesRef.current

				setQueuedMessagesState(remainingQueuedMessages)

				const parentMessageId = queueTailMessageIdRef.current
				const history =
					parentMessageId === null
						? queueHistoryRef.current
						: buildLocalHistorySnapshot(messagesRef.current, parentMessageId)

				activeSendParentMessageIdRef.current = parentMessageId
				activeSendHistoryRef.current = history

				const result = await sendMessage(
					nextQueuedMessage.content,
					nextQueuedMessage.model,
					parentMessageId,
					history
				)

				if (queueStatusRef.current !== 'running') {
					return
				}

				if (result.status === 'done') {
					setQueueTailMessageId(result.assistantMessageId)
					setQueueHistory(
						await readHistorySnapshot(result.assistantMessageId)
					)
					continue
				}

				if (result.status === 'error') {
					if (queuedMessagesRef.current.length > 0) {
						setQueueStatusState('halted')
					} else {
						clearQueuedState()
					}
					return
				}

				clearQueuedState()
				return
			}

			if (
				queueStatusRef.current === 'running' &&
				queuedMessagesRef.current.length === 0
			) {
				clearQueuedState()
			}
		} finally {
			isDrainingQueueRef.current = false
		}
	}, [
		clearQueuedState,
		readHistorySnapshot,
		sendMessage,
		setQueueStatusState,
		setQueueTailMessageId,
		setQueuedMessagesState,
	])

	const hasQueuedWork = queuedMessages.length > 0 || queueStatus === 'halted'

	const handleBranchFromMessage = useCallback(
		(messageId: string) => {
			if (hasQueuedWork) {
				return
			}
			setBranchFromMessageId(messageId)
			scrollToMessage(messageId)
		},
		[hasQueuedWork, scrollToMessage]
	)

	const {
		attachMode,
		graphNodes,
		handleAttachComplete,
		handleGraphAction,
		handleStartAttach,
		selectedNodeIds,
		selectedNodes,
		setSelectedNodeIds,
		showGraphView,
		toggleGraphView,
	} = useChatAreaGraph({
		messages,
		isAuthenticated: !!user,
		interactionsLocked: hasQueuedWork,
		clearBranchContext: () => setBranchFromMessageId(null),
		onFocusMessage: scrollToMessage,
		onRequireSignIn: () => setShowSignInModal(true),
		onStartBranch: handleBranchFromMessage,
	})

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.key === 'i') {
				event.preventDefault()
				inputRef.current?.focus()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	useEffect(() => {
		const wasStreaming = previousIsStreamingRef.current
		previousIsStreamingRef.current = isStreaming

		if (wasStreaming && !isStreaming && messages.length > 0) {
			invalidateConversationList()
		}
	}, [invalidateConversationList, isStreaming, messages.length])

	useEffect(() => {
		if (
			pendingConversationId &&
			!isStreaming &&
			selectedConversationId === pendingConversationId
		) {
			setPendingConversationId(null)
		}
	}, [isStreaming, pendingConversationId, selectedConversationId])

	useEffect(() => {
		const previousSelectedConversationId = selectedConversationIdRef.current
		selectedConversationIdRef.current = selectedConversationId

		if (
			previousSelectedConversationId === selectedConversationId ||
			(pendingConversationId && selectedConversationId === pendingConversationId)
		) {
			return
		}

		clearQueuedState()
	}, [clearQueuedState, pendingConversationId, selectedConversationId])

	const handleSendMessage = useCallback(
		async (content: string, model: string) => {
			const branchId = branchFromMessageId
			const parentMessageId = branchId ?? displayedMessages.at(-1)?.id ?? null
			const history: MessageHistoryEntry[] = displayedMessages.map(
				({ role, content }) => ({
					role,
					content,
				})
			)

			if (branchId) {
				setBranchFromMessageId(null)
			}

			if (
				isStreaming ||
				queuedMessagesRef.current.length > 0 ||
				queueStatusRef.current === 'halted'
			) {
				enqueueMessage(
					content,
					model,
					queueTailMessageIdRef.current ??
						activeSendParentMessageIdRef.current ??
						parentMessageId,
					queueHistoryRef.current.length > 0
						? queueHistoryRef.current
						: isStreaming && activeSendHistoryRef.current.length > 0
							? activeSendHistoryRef.current
							: history
				)

				if (
					!isStreaming &&
					queueStatusRef.current === 'running' &&
					!isDrainingQueueRef.current
				) {
					void drainQueuedMessages()
				}

				return
			}

			activeSendParentMessageIdRef.current = parentMessageId
			activeSendHistoryRef.current = history

			const result = await sendMessage(content, model, parentMessageId, history)

			if (queuedMessagesRef.current.length === 0) {
				return
			}

			if (result.status === 'done') {
				setQueueTailMessageId(result.assistantMessageId)
				setQueueHistory(await readHistorySnapshot(result.assistantMessageId))
				void drainQueuedMessages()
				return
			}

			if (result.status === 'error') {
				setQueueStatusState('halted')
				return
			}

			clearQueuedState()
		},
		[
			branchFromMessageId,
			clearQueuedState,
			displayedMessages,
			drainQueuedMessages,
			enqueueMessage,
			isStreaming,
			readHistorySnapshot,
			sendMessage,
			setQueueHistory,
			setQueueStatusState,
			setQueueTailMessageId,
		]
	)

	const handleRetry = useCallback(
		async (messageId: string) => {
			if (hasQueuedWork) {
				return
			}
			await regenerate(messageId)
		},
		[hasQueuedWork, regenerate]
	)

	const handleEdit = useCallback(
		async (messageId: string, newContent: string) => {
			if (hasQueuedWork) {
				return
			}
			await editAndRegenerate(messageId, newContent)
		},
		[editAndRegenerate, hasQueuedWork]
	)

	const handleEditParent = useCallback(
		(messageId: string) => {
			if (hasQueuedWork) {
				return
			}
			const editHandler = editHandlersRef.current.get(messageId)
			if (editHandler) {
				scrollToMessage(messageId)
				setTimeout(() => editHandler(), 300)
			}
		},
		[hasQueuedWork, scrollToMessage]
	)

	const handleStopGeneration = useCallback(() => {
		stopGeneration()
		clearQueuedState()
	}, [clearQueuedState, stopGeneration])

	const handleRemoveQueuedMessage = useCallback(
		(queueMessageId: string) => {
			const nextQueuedMessages = queuedMessagesRef.current.filter(
				(queuedMessage) => queuedMessage.id !== queueMessageId
			)

			setQueuedMessagesState(nextQueuedMessages)

			if (nextQueuedMessages.length === 0) {
				clearQueuedState()
			}
		},
		[clearQueuedState, setQueuedMessagesState]
	)

	const handleClearQueue = useCallback(() => {
		clearQueuedState()
	}, [clearQueuedState])

	const handleResumeQueue = useCallback(() => {
		if (
			queueStatusRef.current !== 'halted' ||
			queuedMessagesRef.current.length === 0 ||
			isStreaming
		) {
			return
		}

		setQueueStatusState('running')
		void drainQueuedMessages()
	}, [drainQueuedMessages, isStreaming, setQueueStatusState])

	const handleClearBranchContext = useCallback(() => {
		if (hasQueuedWork) {
			return
		}

		setBranchFromMessageId(null)
	}, [hasQueuedWork])

	const handleNewChat = useCallback(() => {
		setPendingConversationId(null)
		handleStopGeneration()
		clearMessages()
		handleDeselectAllMessages()
		router.replace('/chat', { scroll: false })
	}, [
		clearMessages,
		handleDeselectAllMessages,
		handleStopGeneration,
		router,
	])

	const handleRename = useCallback(
		async (newTitle: string) => {
			if (
				conversationId &&
				newTitle &&
				newTitle.trim() !== conversation?.title?.trim()
			) {
				await updateConversation({ id: conversationId, title: newTitle })
			}
		},
		[conversation?.title, conversationId, updateConversation]
	)

	const getSiblingNav = useCallback(
		(message: Message) => {
			const siblings = getSiblings(message)
			if (siblings.length <= 1) return undefined

			const siblingIndex = getSiblingIndex(message)
			return {
				currentIndex: siblingIndex,
				totalCount: siblings.length,
				onPrevious: () => navigateSibling(message, 'prev'),
				onNext: () => navigateSibling(message, 'next'),
				disabled: hasQueuedWork,
			}
		},
		[getSiblingIndex, getSiblings, hasQueuedWork, navigateSibling]
	)

	return (
		<main
			className="relative flex h-full flex-1 flex-col overflow-hidden rounded-l-[29px]"
			style={{
				background: 'var(--chat-background, var(--background))',
			}}
		>
			<div
				className="pointer-events-none absolute right-[46px] top-[-68px] h-[373px] w-[373px] rounded-full bg-primary/20 opacity-[0.08]"
				style={{ filter: 'blur(280px)' }}
			/>

			<TopBar
				onNewChat={handleNewChat}
				title={conversation?.title}
				onRename={handleRename}
				onExport={() => setShowExportDialog(true)}
				onShare={handleShareCurrentView}
				onToggleGraph={toggleGraphView}
				showGraphView={showGraphView}
			/>

			{error ? (
				<div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
					<AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
					<p className="text-sm text-destructive">
						{error === 'Unauthorized' ? (
							<>
								Please{' '}
								<a
									href="/login"
									className="font-medium underline hover:no-underline"
								>
									log in
								</a>{' '}
								to send messages.
							</>
						) : (
							error
						)}
					</p>
				</div>
			) : null}

			{!showGraphView ? (
				<ConversationMessageList
					displayedMessages={displayedMessages}
					messagesContainerRef={messagesContainerRef}
					messagesEndRef={messagesEndRef}
					isStreaming={isStreaming}
					getSiblingNav={getSiblingNav}
					activeMessageId={activeMessageId}
					selectedMessageIds={selectedMessageIds}
					onToggleMessageSelection={handleToggleMessageSelection}
					onRetry={handleRetry}
					onStop={handleStopGeneration}
					onEdit={handleEdit}
					onEditParent={handleEditParent}
					editHandlersRef={editHandlersRef}
					disableMutatingActions={hasQueuedWork}
				/>
			) : null}

			<SignInPromptModal
				open={showSignInModal}
				onOpenChange={setShowSignInModal}
			/>

			<ConversationExportDialog
				open={showExportDialog}
				onOpenChange={setShowExportDialog}
				messages={displayedMessages}
				conversationTitle={conversation?.title ?? 'Untitled Conversation'}
			/>

			{conversationId ? (
				<SelectiveShareModal
					open={showSelectiveShareModal}
					onOpenChange={(open) => {
						setShowSelectiveShareModal(open)
						if (!open) handleDeselectAllMessages()
					}}
					conversationId={conversationId}
					conversationTitle={conversation?.title ?? 'Untitled Conversation'}
					selectedMessageIds={shareModalMessageIds}
					allMessages={messages}
					onAutoCompletePairs={handleAutoCompletePairs}
				/>
			) : null}

			{showScrollButton ? (
				<button
					onClick={() => scrollToBottom('smooth')}
					className="animate-in fade-in slide-in-from-bottom-2 fixed bottom-32 right-8 z-20 rounded-full bg-[#57FCFF]/90 p-3 text-black shadow-lg transition-all hover:bg-[#57FCFF]"
					title="Scroll to bottom"
					aria-label="Scroll to bottom"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12 5v14M19 12l-7 7-7-7" />
					</svg>
				</button>
			) : null}

			{showGraphView && conversationId ? (
				<div className="relative z-30 flex-1 overflow-hidden">
					<GraphMap
						conversationId={conversationId}
						selectedNodeIds={selectedNodeIds}
						onSelectNodes={setSelectedNodeIds}
						searchQuery=""
						focusMode={false}
						onAction={handleGraphAction}
						showMinimap={true}
						attachMode={attachMode}
						onAttachComplete={handleAttachComplete}
					/>
					{selectedNodeIds.size > 0 ? (
						<GraphInspector
							selectedNodeIds={selectedNodeIds}
							selectedNodes={selectedNodes}
							graph={{
								id: conversationId,
								nodes: graphNodes,
							}}
							onClose={() => setSelectedNodeIds(new Set())}
							onSelectNode={(id) => setSelectedNodeIds(new Set([id]))}
							onAction={handleGraphAction}
							attachMode={attachMode}
							onStartAttach={handleStartAttach}
						/>
					) : null}
				</div>
			) : null}

			{!showGraphView && messages.length > 0 ? (
				<ChatTOC
					messages={tocMessages}
					onScrollToMessage={scrollToMessage}
					selectedMessageIds={selectedMessageIds}
					onToggleSelection={handleToggleMessageSelection}
					onSelectAll={handleSelectAllMessages}
					onDeselectAll={handleDeselectAllMessages}
					activeMessageId={activeMessageId}
					onShare={handleShareMessages}
					isStreaming={isStreaming}
				/>
			) : null}

			{!showGraphView ? (
				<div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-6">
					<ChatInput
						ref={inputRef}
						onSendMessage={handleSendMessage}
						onStop={handleStopGeneration}
						isStreaming={isStreaming}
						queuedMessages={queuedMessages}
						queueStatus={queueStatus}
						onRemoveQueuedMessage={handleRemoveQueuedMessage}
						onClearQueue={handleClearQueue}
						onResumeQueue={handleResumeQueue}
						branchContext={
							branchFromMessageId
								? {
										messageId: branchFromMessageId,
										preview:
											messages
												.find((message) => message.id === branchFromMessageId)
												?.content.slice(0, 80) ?? '',
								  }
								: null
						}
						onClearBranchContext={handleClearBranchContext}
					/>
				</div>
			) : null}
		</main>
	)
}
