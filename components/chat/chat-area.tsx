'use client'

import { useAuth } from '@/contexts/auth-context'
import { useChat, type Message } from '@/hooks/use-chat'
import { useConversation, useConversations } from '@/hooks/use-conversations'
import { useMessageTree } from '@/hooks/use-message-tree'
import { useSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	Bot,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Copy,
	Pencil,
	RefreshCw,
	Square,
	ThumbsDown,
	ThumbsUp,
	X,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatInput } from './chat-input'
import { ChatTOC } from './ChatTOC'
import { EmptyState } from './empty-state'
import { FeedbackModal } from './feedback-modal'
import { MarkdownRenderer } from './markdown-renderer'
import { SignInPromptModal } from './sign-in-prompt-modal'
import { TopBar } from './top-bar'

// Lazy load graph components
const GraphMap = dynamic(() => import('./GraphMap'), { ssr: false })
const GraphInspector = dynamic(() => import('./GraphInspector'), { ssr: false })

export function ChatArea() {
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messagesContainerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const editHandlersRef = useRef<Map<string, () => void>>(new Map())
	const [isNearBottom, setIsNearBottom] = useState(true)
	const [showScrollButton, setShowScrollButton] = useState(false)
	const [showGraphView, setShowGraphView] = useState(false)
	const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
	const [attachMode, setAttachMode] = useState<string | null>(null)
	const [branchFromMessageId, setBranchFromMessageId] = useState<string | null>(
		null
	)
	const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
		new Set()
	)
	const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
	const [showSignInModal, setShowSignInModal] = useState(false)

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
			// Update URL or notify parent when a new conversation is created
			window.history.replaceState({}, '', `/chat?c=${id}`)
		},
		onTitleGenerationNeeded: async (id) => {
			// Generate AI title in the background
			await generateTitle(id)
		},
		onError: (err) => {
			console.error('Chat error:', err)
		},
	})

	// Message tree for sibling navigation and branch filtering
	const {
		getSiblings,
		getSiblingIndex,
		navigateSibling,
		getActivePath,
		getAncestorPath,
	} = useMessageTree(messages)

	// Compute displayed messages based on branch context or active path
	const displayedMessages = useMemo(() => {
		if (branchFromMessageId) {
			// When branching, show only ancestors up to the branch point
			return getAncestorPath(messages, branchFromMessageId)
		}
		// Normal mode: show active path through the tree
		return getActivePath(messages)
	}, [messages, branchFromMessageId, getAncestorPath, getActivePath])

	// Check if user is scrolled near the bottom
	const checkScrollPosition = useCallback(() => {
		const container = messagesContainerRef.current
		if (!container) return

		const threshold = 100 // pixels from bottom
		const isNear =
			container.scrollHeight - container.scrollTop - container.clientHeight <
			threshold
		setIsNearBottom(isNear)
		setShowScrollButton(!isNear && messages.length > 0)
	}, [messages.length])

	// Fetch conversation details (including title) - Must be after useChat to have conversationId
	const { data: conversation } = useConversation(conversationId)

	// Auto-scroll to bottom when new messages arrive
	const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
		messagesEndRef.current?.scrollIntoView({ behavior })
		setIsNearBottom(true)
		setShowScrollButton(false)
	}, [])

	// Scroll to a specific message by ID
	const scrollToMessage = useCallback((messageId: string) => {
		const element = document.getElementById(`message-${messageId}`)
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' })
			setActiveMessageId(messageId)
			setTimeout(() => setActiveMessageId(null), 2000)
		}
	}, [])

	// Message selection handlers
	const handleToggleMessageSelection = useCallback((messageId: string) => {
		setSelectedMessageIds((prev) => {
			const next = new Set(prev)
			if (next.has(messageId)) {
				next.delete(messageId)
			} else {
				next.add(messageId)
			}
			return next
		})
	}, [])

	const handleSelectAllMessages = useCallback(() => {
		const visibleMessages = messages.filter(
			(m) => m.role === 'user' || m.role === 'assistant'
		)
		setSelectedMessageIds(new Set(visibleMessages.map((m) => m.id)))
	}, [messages])

	const handleDeselectAllMessages = useCallback(() => {
		setSelectedMessageIds(new Set())
	}, [])

	const handleShareMessages = useCallback(
		(messageIds: string[]) => {
			if (messageIds.length === 0) return

			// Filter messages to share
			const messagesToShare = messages.filter((m) => messageIds.includes(m.id))

			// Create shareable text
			const shareText = messagesToShare
				.map((m) => {
					const role = m.role === 'user' ? 'User' : 'Assistant'
					return `**${role}:**\n${m.content}\n`
				})
				.join('\n')

			// Copy to clipboard
			navigator.clipboard
				.writeText(shareText)
				.then(() => {
					console.log('Shared messages:', messageIds.length)
					// Could show a toast notification here
				})
				.catch((err) => {
					console.error('Failed to copy to clipboard:', err)
				})

			// Deselect all after sharing
			handleDeselectAllMessages()
		},
		[messages, handleDeselectAllMessages]
	)

	const handleGraphAction = useCallback(
		(action: string, nodeId?: string) => {
			switch (action) {
				case 'delete':
					if (nodeId) {
						console.log('Delete node:', nodeId)
						// Would call deleteMessage API
					}
					break
				case 'branch':
					if (nodeId) {
						setBranchFromMessageId(nodeId)
						setShowGraphView(false)
						scrollToMessage(nodeId)
					}
					break
				case 'focus':
					if (nodeId) {
						setShowGraphView(false)
						scrollToMessage(nodeId)
					}
					break
				case 'attach':
					if (nodeId) {
						setAttachMode('attach')
					}
					break
				case 'unlink':
					if (nodeId) {
						console.log('Unlink node:', nodeId)
						// Would call API to unlink message
					}
					break
				default:
					console.log('Graph action:', action, nodeId)
			}
		},
		[scrollToMessage]
	)

	const handleStartAttach = useCallback((nodeId: string) => {
		setAttachMode('attach')
		console.log('Start attach from:', nodeId)
	}, [])

	const handleAttachComplete = useCallback(
		(sourceId: string, targetId: string) => {
			console.log('Attach complete:', sourceId, '->', targetId)
			// Would call API to link messages
			setAttachMode(null)
		},
		[]
	)

	const handleBranchFromMessage = useCallback(
		(messageId: string) => {
			setBranchFromMessageId(messageId)
			scrollToMessage(messageId)
		},
		[scrollToMessage]
	)

	// Only auto-scroll if user is near bottom (respects manual scrolling)
	useEffect(() => {
		if (isNearBottom) {
			scrollToBottom('smooth')
		}
	}, [messages, isNearBottom, scrollToBottom])

	// Listen for scroll events
	useEffect(() => {
		const container = messagesContainerRef.current
		if (!container) return

		const handleScroll = () => {
			checkScrollPosition()
		}

		container.addEventListener('scroll', handleScroll)
		return () => container.removeEventListener('scroll', handleScroll)
	}, [checkScrollPosition])

	// Load chat from sessionStorage or URL
	useEffect(() => {
		const loadChat = async () => {
			// Check URL params first
			const params = new URLSearchParams(window.location.search)
			const urlConversationId = params.get('c')

			if (urlConversationId) {
				await loadConversation(urlConversationId)
				return
			}

			// Clear old sessionStorage data that has fake IDs (migration cleanup)
			const selectedChatData = sessionStorage.getItem('selectedChat')
			if (selectedChatData) {
				try {
					const chat = JSON.parse(selectedChatData)
					// Only load if it looks like a real CUID (at least 20 chars)
					// Old hardcoded data had simple IDs like "1", "2", "3"
					if (chat.id && chat.id.length > 10) {
						await loadConversation(chat.id)
					} else {
						// Clear old fake data
						sessionStorage.removeItem('selectedChat')
					}
				} catch (error) {
					console.error('Failed to load chat:', error)
					sessionStorage.removeItem('selectedChat')
				}
			}
		}

		loadChat()

		// Listen for custom event to reload chat
		const handleChatChange = async (e: Event) => {
			const customEvent = e as CustomEvent
			if (customEvent.detail?.conversationId) {
				await loadConversation(customEvent.detail.conversationId)
			} else if (customEvent.detail?.newChat) {
				clearMessages()
				window.history.replaceState({}, '', '/chat')
			}
		}

		window.addEventListener('chatChanged', handleChatChange)

		return () => {
			window.removeEventListener('chatChanged', handleChatChange)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Only run on mount

	// Global keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl+I to focus input
			if (e.ctrlKey && e.key === 'i') {
				e.preventDefault()
				inputRef.current?.focus()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Invalidate conversations list when stream completes (for sidebar update)
	useEffect(() => {
		if (!isStreaming && messages.length > 0) {
			invalidateConversations()
		}
	}, [isStreaming, messages.length, invalidateConversations])

	const handleSendMessage = useCallback(
		async (content: string, model: string) => {
			await sendMessage(content, model)
		},
		[sendMessage]
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
				// Scroll to message
				scrollToMessage(messageId)
				// Trigger edit mode after scroll
				setTimeout(() => editHandler(), 300)
			}
		},
		[scrollToMessage]
	)

	const handleNewChat = useCallback(() => {
		clearMessages()
		window.history.replaceState({}, '', '/chat')
		// Dispatch event for sidebar
		window.dispatchEvent(
			new CustomEvent('chatChanged', { detail: { newChat: true } })
		)
	}, [clearMessages])

	const handleRename = useCallback(
		async (newTitle: string) => {
			if (conversationId && newTitle) {
				await updateConversation({ id: conversationId, title: newTitle })
				// Invalidate to refresh sidebar
				invalidateConversations()
			}
		},
		[conversationId, updateConversation, invalidateConversations]
	)

	return (
		<main
			className="flex-1 h-full relative flex flex-col overflow-hidden rounded-l-[29px]"
			style={{
				background: 'linear-gradient(180deg, #0A2727 0%, #0C1110 100%)',
			}}
		>
			{/* Static Blur Effect - Top Right */}
			<div
				className="absolute top-[-68px] right-[46px] w-[373px] h-[373px] rounded-full bg-[#D9D9D9] opacity-[0.28] pointer-events-none"
				style={{ filter: 'blur(481.8px)' }}
			/>

			{/* Top Bar */}
			<TopBar
				onNewChat={handleNewChat}
				title={conversation?.title}
				onRename={handleRename}
				messages={messages}
				onToggleGraph={() => {
					// Clear branch state when entering graph view
					if (!showGraphView) {
						setBranchFromMessageId(null)
					}
					setShowGraphView(!showGraphView)
				}}
				showGraphView={showGraphView}
			/>

			{/* Error Banner */}
			{error && (
				<div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
					<AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
					<p className="text-sm text-destructive">
						{error === 'Unauthorized' ? (
							<>
								Please{' '}
								<a
									href="/login"
									className="underline hover:no-underline font-medium"
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
			)}

			{/* Content Area */}
			{!showGraphView && (
				<div
					ref={messagesContainerRef}
					className="flex-1 overflow-y-auto relative w-full"
				>
					{displayedMessages.length > 0 ? (
						<div className="max-w-4xl mx-auto px-12 py-8 space-y-6">
							{/* Messages */}
							{displayedMessages.map((message) => {
								const siblings = getSiblings(message)
								const siblingIndex = getSiblingIndex(message)

								return (
									<MessageBubble
										key={message.id}
										message={message}
										onRetry={handleRetry}
										onStop={stopGeneration}
										onEdit={handleEdit}
										isStreaming={isStreaming}
										allMessages={displayedMessages}
										onEditParent={handleEditParent}
										siblingNav={
											siblings.length > 1
												? {
														currentIndex: siblingIndex,
														totalCount: siblings.length,
														onPrevious: () => navigateSibling(message, 'prev'),
														onNext: () => navigateSibling(message, 'next'),
													}
												: undefined
										}
										isActive={activeMessageId === message.id}
										isSelected={selectedMessageIds.has(message.id)}
										onToggleSelection={() =>
											handleToggleMessageSelection(message.id)
										}
										editHandlersRef={editHandlersRef}
									/>
								)
							})}
						</div>
					) : (
						<div className="h-full flex items-center justify-center max-w-3xl mx-auto px-6">
							<EmptyState />
						</div>
					)}
				</div>
			)}

			{/* Sign In Prompt Modal */}
			<SignInPromptModal
				open={showSignInModal}
				onOpenChange={setShowSignInModal}
			/>
			{/* Scroll to Bottom Button */}
			{showScrollButton && (
				<button
					onClick={() => scrollToBottom('smooth')}
					className="fixed bottom-32 right-8 p-3 rounded-full bg-[#57FCFF]/90 hover:bg-[#57FCFF] text-black shadow-lg transition-all z-20 animate-in fade-in slide-in-from-bottom-2"
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
			)}

			{/* Graph View */}
			{showGraphView && conversationId && (
				<div className="flex-1 relative z-30">
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
					{selectedNodeIds.size > 0 && (
						<GraphInspector
							selectedNodeIds={selectedNodeIds}
							selectedNodes={displayedMessages
								.filter((m) => selectedNodeIds.has(m.id))
								.map((m) => ({
									id: m.id,
									role: m.role,
									text: m.content,
									replyTo: m.parentMessageId ?? null,
									parentMessageId: m.parentMessageId ?? null,
									x: 0,
									y: 0,
									createdAt: m.createdAt
										? new Date(m.createdAt).getTime()
										: Date.now(),
									model: m.model ?? null,
									isError: m.isError ?? false,
								}))}
							graph={{
								id: conversationId,
								nodes: displayedMessages.map((m) => ({
									id: m.id,
									role: m.role,
									text: m.content,
									replyTo: m.parentMessageId ?? null,
									parentMessageId: m.parentMessageId ?? null,
									x: 0,
									y: 0,
									createdAt: m.createdAt
										? new Date(m.createdAt).getTime()
										: Date.now(),
									model: m.model ?? null,
									isError: m.isError ?? false,
								})),
							}}
							onClose={() => setSelectedNodeIds(new Set())}
							onSelectNode={(id) => setSelectedNodeIds(new Set([id]))}
							onAction={handleGraphAction}
							attachMode={attachMode}
							onStartAttach={handleStartAttach}
						/>
					)}
				</div>
			)}

			{/* Table of Contents */}
			{!showGraphView && messages.length > 0 && (
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
			)}

			{/* Input Area */}
			{!showGraphView && (
				<div className="w-full max-w-4xl mx-auto px-6 pb-6 relative z-10">
					<ChatInput
						ref={inputRef}
						onSendMessage={handleSendMessage}
						onStop={stopGeneration}
						isStreaming={isStreaming}
					/>
				</div>
			)}
		</main>
	)
}

// Message bubble component
interface MessageBubbleProps {
	message: Message
	onRetry: (messageId: string) => void
	onStop: () => void
	onEdit: (messageId: string, newContent: string) => void
	isStreaming: boolean
	allMessages: Message[]
	siblingNav?: {
		currentIndex: number
		totalCount: number
		onPrevious: () => void
		onNext: () => void
	}
	isActive?: boolean
	isSelected?: boolean
	onToggleSelection?: () => void
	onEditParent?: (messageId: string) => void
	editHandlersRef?: React.MutableRefObject<Map<string, () => void>>
}

// Lightweight streaming renderer that displays the current content as plain
// inline text and places the blinking cursor immediately after the current
// generating word so the cursor appears to traverse through the word while
// characters are being appended.
function StreamingText({ content }: { content: string }) {
	const trailingMatch = content.match(/(\s*)$/)
	const trailing = trailingMatch ? trailingMatch[0] : ''
	const withoutTrailing = content.slice(0, content.length - trailing.length)

	const lastSpaceIndex = Math.max(
		withoutTrailing.lastIndexOf(' '),
		withoutTrailing.lastIndexOf('\n'),
		withoutTrailing.lastIndexOf('\t')
	)

	const stable =
		lastSpaceIndex >= 0 ? withoutTrailing.slice(0, lastSpaceIndex + 1) : ''
	const currentWord =
		lastSpaceIndex >= 0
			? withoutTrailing.slice(lastSpaceIndex + 1)
			: withoutTrailing

	return (
		<span className="whitespace-pre-wrap">
			{stable}
			<span>{currentWord}</span>
			<span className="inline-block w-1 h-5 ml-1 bg-primary animate-pulse" />
			{trailing}
		</span>
	)
}

function MessageBubble({
	message,
	onRetry,
	onStop,
	onEdit,
	isStreaming,
	allMessages,
	siblingNav,
	isActive = false,
	isSelected = false,
	onToggleSelection,
	onEditParent,
	editHandlersRef,
}: MessageBubbleProps) {
	const isUser = message.role === 'user'
	const isAssistant = message.role === 'assistant'
	const [isEditing, setIsEditing] = useState(false)
	const [isExpanded, setIsExpanded] = useState(false)
	const [editContent, setEditContent] = useState(message.content)
	const [copied, setCopied] = useState(false)
	const [feedbackGiven, setFeedbackGiven] = useState<'good' | 'bad' | null>(
		null
	)
	const [showFeedbackModal, setShowFeedbackModal] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const { settings } = useSettings()

	// Register edit handler for user messages
	useEffect(() => {
		if (isUser && editHandlersRef) {
			editHandlersRef.current.set(message.id, () => setIsEditing(true))
			return () => {
				editHandlersRef.current.delete(message.id)
			}
		}
	}, [message.id, isUser, editHandlersRef])

	// Check if this message is an edited version (has siblings)
	const hasEditedVersions = siblingNav && siblingNav.totalCount > 1

	// Check if message should be truncated
	const shouldTruncate =
		isUser &&
		!isEditing &&
		message.content.length > settings.messageTruncateLength
	const displayContent =
		shouldTruncate && !isExpanded
			? message.content.slice(0, settings.messageTruncateLength) + '...'
			: message.content

	// Auto-resize textarea
	useEffect(() => {
		if (isEditing && textareaRef.current) {
			textareaRef.current.focus()
			// Set cursor to end
			textareaRef.current.setSelectionRange(
				textareaRef.current.value.length,
				textareaRef.current.value.length
			)
		}
	}, [isEditing])

	const handleSaveEdit = () => {
		if (editContent.trim() && editContent !== message.content) {
			onEdit(message.id, editContent)
		}
		setIsEditing(false)
	}

	const handleCancelEdit = () => {
		setEditContent(message.content)
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSaveEdit()
		} else if (e.key === 'Escape') {
			handleCancelEdit()
		}
	}

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(message.content)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			console.error('Failed to copy:', err)
		}
	}

	const handleFeedback = async (type: 'good' | 'bad') => {
		setFeedbackGiven(type)
		if (type === 'bad') {
			setShowFeedbackModal(true)
		} else {
			// Good feedback - send immediately
			try {
				await fetch('/api/chat/feedback', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						messageId: message.id,
						type: 'good',
						reasons: [],
						comment: '',
					}),
				})
			} catch (err) {
				console.error('Failed to submit feedback:', err)
			}
		}
	}

	const handleFeedbackSubmit = async (reasons: string[], comment: string) => {
		try {
			await fetch('/api/chat/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messageId: message.id,
					type: 'bad',
					reasons,
					comment,
				}),
			})
		} catch (err) {
			console.error('Failed to submit feedback:', err)
			throw err
		}
	}

	return (
		<>
			<FeedbackModal
				isOpen={showFeedbackModal}
				onClose={() => setShowFeedbackModal(false)}
				onSubmit={handleFeedbackSubmit}
			/>
			<div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
				<div
					id={`message-${message.id}`}
					className={cn(
						'max-w-full rounded-2xl px-6 py-4 relative group overflow-hidden transition-all',
						isUser
							? 'bg-[#57FCFF]/10 border border-[#57FCFF]/20 ml-auto'
							: 'bg-[#1a2029]/50 border border-border/50',
						message.isError && 'border-destructive/50 bg-destructive/5',
						isActive && 'ring-2 ring-primary/50 shadow-lg shadow-primary/20'
					)}
				>
					{/* Selection checkbox */}
					{onToggleSelection && (
						<button
							onClick={onToggleSelection}
							className="absolute -left-10 top-4 opacity-0 group-hover:opacity-100 transition-opacity"
							title="Select message"
						>
							<div
								className={cn(
									'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
									isSelected
										? 'bg-primary border-primary'
										: 'border-muted-foreground/50 hover:border-primary'
								)}
							>
								{isSelected && (
									<Check className="w-3 h-3 text-primary-foreground" />
								)}
							</div>
						</button>
					)}
					{/* Model indicator for assistant */}
					{isAssistant && message.model && (
						<div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium flex items-center gap-2">
							<Bot className="w-3 h-3" />
							{message.model}
							{message.isStreaming && (
								<button
									onClick={onStop}
									className="p-1 rounded hover:bg-destructive/20 transition-colors group"
									title="Stop generating"
								>
									<Square className="w-3 h-3 fill-current text-muted-foreground group-hover:text-destructive" />
								</button>
							)}
						</div>
					)}

					{/* Message content */}
					<div className="text-foreground leading-relaxed">
						{isEditing && isUser ? (
							<div className="space-y-2 w-fit min-w-[100px] max-w-full">
								<div className="grid leading-relaxed">
									<div className="col-start-1 row-start-1 invisible whitespace-pre-wrap break-words px-3 py-2 min-h-[60px] border border-transparent text-foreground">
										{editContent + ' '}
									</div>
									<textarea
										ref={textareaRef}
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onKeyDown={handleKeyDown}
										className="col-start-1 row-start-1 w-full h-full bg-transparent border border-primary/30 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary resize-none overflow-hidden leading-relaxed"
										placeholder="Edit your message..."
									/>
								</div>
								<div className="flex justify-end gap-2">
									<button
										onClick={handleCancelEdit}
										className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										<X className="w-3 h-3" />
										Cancel
									</button>
									<button
										onClick={handleSaveEdit}
										className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
									>
										<Check className="w-3 h-3" />
										Save & Resend
									</button>
								</div>
							</div>
						) : message.content ? (
							isAssistant ? (
								// While assistant is streaming, render a lightweight
								// inline text view that includes the cursor so it stays
								// inside the flowing paragraph/word. After streaming
								// completes we render the full Markdown output.
								message.isStreaming ? (
									<StreamingText content={message.content} />
								) : (
									<MarkdownRenderer content={message.content} />
								)
							) : (
								<div
									onClick={() => !isEditing && setIsEditing(true)}
									className="cursor-pointer hover:opacity-80 transition-opacity"
									title="Click to edit"
								>
									<span className="whitespace-pre-wrap">{displayContent}</span>
									{shouldTruncate && (
										<button
											onClick={(e) => {
												e.stopPropagation()
												setIsExpanded(!isExpanded)
											}}
											className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
										>
											{isExpanded ? 'Show less' : 'Show more'}
											<ChevronDown
												className={cn(
													'w-3 h-3 transition-transform',
													isExpanded && 'rotate-180'
												)}
											/>
										</button>
									)}
								</div>
							)
						) : (
							// Empty content handler
							<div className="flex items-start gap-3 p-3 rounded-lg bg-[#1a1d24]/50 border border-border/30">
								<AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
								<div className="flex-1">
									<div className="text-sm text-muted-foreground">
										{message.isStreaming ? (
											<span className="italic">Thinking...</span>
										) : (
											<>
												<div className="font-medium mb-1">
													No response generated
												</div>
												<div className="text-xs opacity-70">
													The AI returned an empty response. This might be due
													to a network issue or API limitation.
												</div>
											</>
										)}
									</div>
									{!message.isStreaming && isAssistant && (
										<button
											onClick={() => onRetry(message.id)}
											className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
										>
											<RefreshCw className="w-3 h-3" />
											Try Again
										</button>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Edit button to the left of user message */}
					{isUser && !isEditing && !isStreaming && (
						<button
							onClick={() => setIsEditing(true)}
							className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-background/50 hover:bg-background transition-all"
							title="Edit message"
						>
							<Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
						</button>
					)}

					{/* Sibling navigation for edited messages */}
					{siblingNav && siblingNav.totalCount > 1 && (
						<div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
							<span className="text-xs text-muted-foreground">
								Version {siblingNav.currentIndex + 1} of {siblingNav.totalCount}
							</span>
							<div className="flex items-center gap-1">
								<button
									onClick={siblingNav.onPrevious}
									disabled={siblingNav.currentIndex === 0}
									className="p-1 rounded hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
									title="Previous version"
								>
									<ChevronLeft className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={siblingNav.onNext}
									disabled={
										siblingNav.currentIndex === siblingNav.totalCount - 1
									}
									className="p-1 rounded hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
									title="Next version"
								>
									<ChevronRight className="w-3.5 h-3.5" />
								</button>
							</div>
						</div>
					)}

					{/* Edited badge */}
					{hasEditedVersions && !isEditing && (
						<div className="mt-2">
							<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
								<Pencil className="w-3 h-3" />
								Edited
							</span>
						</div>
					)}

					{/* Error state with retry button */}
					{message.isError && !message.isStreaming && (
						<div className="mt-3 pt-3 border-t border-destructive/20 flex items-center gap-2">
							<AlertCircle className="w-4 h-4 text-destructive" />
							<span className="text-sm text-destructive">
								Failed to generate
							</span>
							<button
								onClick={() => onRetry(message.id)}
								className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
							>
								<RefreshCw className="w-3 h-3" />
								Retry
							</button>
						</div>
					)}

					{/* Stopped state with continue button */}
					{message.isStopped && !message.isStreaming && isAssistant && (
						<div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
							<span className="text-xs text-muted-foreground">
								Generation stopped
							</span>
							<button
								onClick={() => onRetry(message.id)}
								className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
							>
								<RefreshCw className="w-3 h-3" />
								Continue
							</button>
						</div>
					)}

					{/* Token usage (optional, for debugging) */}
					{isAssistant && !message.isStreaming && message.completionTokens && (
						<div className="mt-2 text-[10px] text-muted-foreground/50 font-mono">
							{message.promptTokens} → {message.completionTokens} tokens
						</div>
					)}
				</div>
			</div>

			{/* Action buttons for assistant messages - Below message */}
			{isAssistant && !message.isStreaming && message.content && (
				<div className="flex items-center justify-start gap-1 mt-2">
					{message.parentMessageId && onEditParent && (
						<button
							onClick={() => onEditParent(message.parentMessageId!)}
							className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded transition-colors"
							title="Edit prompt"
						>
							<Pencil className="w-3.5 h-3.5" />
							Edit
						</button>
					)}
					<button
						onClick={handleCopy}
						className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded transition-colors"
						title="Copy response"
					>
						{copied ? (
							<Check className="w-3.5 h-3.5" />
						) : (
							<Copy className="w-3.5 h-3.5" />
						)}
						{copied ? 'Copied' : 'Copy'}
					</button>
					<button
						onClick={() => handleFeedback('good')}
						disabled={feedbackGiven === 'good'}
						className={cn(
							'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
							feedbackGiven === 'good'
								? 'text-green-500 bg-green-500/10'
								: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
						)}
						title="Good response"
					>
						<ThumbsUp className="w-3.5 h-3.5" />
					</button>
					<button
						onClick={() => handleFeedback('bad')}
						disabled={feedbackGiven === 'bad'}
						className={cn(
							'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
							feedbackGiven === 'bad'
								? 'text-red-500 bg-red-500/10'
								: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
						)}
						title="Bad response"
					>
						<ThumbsDown className="w-3.5 h-3.5" />
					</button>
					<button
						onClick={() => onRetry(message.id)}
						className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded transition-colors"
						title="Retry generation"
					>
						<RefreshCw className="w-3.5 h-3.5" />
						Retry
					</button>
				</div>
			)}

			{/* Hidden edit trigger for user messages */}
			{isUser && !isEditing && (
				<button
					data-edit-trigger
					onClick={() => setIsEditing(true)}
					className="hidden"
					aria-hidden="true"
				/>
			)}
		</>
	)
}
