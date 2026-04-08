'use client'

import { ConversationExportDialog } from '@/components/chat/conversation-export-dialog'
import { useChatUI } from '@/components/chat/chat-ui-provider'
import { ConversationMessageList } from '@/components/chat/chat-area/conversation-message-list'
import { useChatAreaGraph } from '@/components/chat/chat-area/use-chat-area-graph'
import { useChatAreaScroll } from '@/components/chat/chat-area/use-chat-area-scroll'
import { useConversationLoader } from '@/components/chat/use-conversation-loader'
import { useShareSelectionController } from '@/components/chat/use-share-selection-controller'
import { useAuth } from '@/contexts/auth-context'
import { useChat, type Message } from '@/hooks/use-chat'
import { useConversation, useConversations } from '@/hooks/use-conversations'
import { useMessageTree } from '@/hooks/use-message-tree'
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

export function ChatArea() {
	const router = useRouter()
	const { startTitleGeneration, finishTitleGeneration } = useChatUI()
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const editHandlersRef = useRef<Map<string, () => void>>(new Map())
	const [branchFromMessageId, setBranchFromMessageId] = useState<string | null>(
		null
	)
	const [showExportDialog, setShowExportDialog] = useState(false)

	const { user } = useAuth()

	const { invalidateConversations, generateTitle, updateConversation } =
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
		onConversationCreated: (id) => {
			router.replace(`/chat?c=${id}`, { scroll: false })
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

	useConversationLoader({
		conversationId,
		loadConversation,
		clearMessages,
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

	const handleBranchFromMessage = useCallback(
		(messageId: string) => {
			setBranchFromMessageId(messageId)
			scrollToMessage(messageId)
		},
		[scrollToMessage]
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
		if (!isStreaming && messages.length > 0) {
			invalidateConversations()
		}
	}, [invalidateConversations, isStreaming, messages.length])

	const handleSendMessage = useCallback(
		async (content: string, model: string) => {
			if (branchFromMessageId && !user) {
				setShowSignInModal(true)
				return
			}
			const branchId = branchFromMessageId
			if (branchId) setBranchFromMessageId(null)
			await sendMessage(content, model, branchId ?? undefined)
		},
		[branchFromMessageId, sendMessage, user]
	)

	const handleRetry = useCallback(
		async (messageId: string) => {
			await regenerate(messageId)
		},
		[regenerate]
	)

	const handleEdit = useCallback(
		async (messageId: string, newContent: string) => {
			await editAndRegenerate(messageId, newContent)
		},
		[editAndRegenerate]
	)

	const handleEditParent = useCallback(
		(messageId: string) => {
			const editHandler = editHandlersRef.current.get(messageId)
			if (editHandler) {
				scrollToMessage(messageId)
				setTimeout(() => editHandler(), 300)
			}
		},
		[scrollToMessage]
	)

	const handleNewChat = useCallback(() => {
		clearMessages()
		handleDeselectAllMessages()
		router.replace('/chat', { scroll: false })
	}, [clearMessages, handleDeselectAllMessages, router])

	const handleRename = useCallback(
		async (newTitle: string) => {
			if (
				conversationId &&
				newTitle &&
				newTitle.trim() !== conversation?.title?.trim()
			) {
				await updateConversation({ id: conversationId, title: newTitle })
				invalidateConversations()
			}
		},
		[conversation?.title, conversationId, invalidateConversations, updateConversation]
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
			}
		},
		[getSiblingIndex, getSiblings, navigateSibling]
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
					onStop={stopGeneration}
					onEdit={handleEdit}
					onEditParent={handleEditParent}
					editHandlersRef={editHandlersRef}
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
					messages={displayedMessages}
					onScrollToMessage={scrollToMessage}
					selectedMessageIds={selectedMessageIds}
					onToggleSelection={handleToggleMessageSelection}
					onSelectAll={handleSelectAllMessages}
					onDeselectAll={handleDeselectAllMessages}
					activeMessageId={activeMessageId}
					onShare={handleShareMessages}
				/>
			) : null}

			{!showGraphView ? (
				<div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-6">
					<ChatInput
						ref={inputRef}
						onSendMessage={handleSendMessage}
						onStop={stopGeneration}
						isStreaming={isStreaming}
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
						onClearBranchContext={() => setBranchFromMessageId(null)}
					/>
				</div>
			) : null}
		</main>
	)
}
