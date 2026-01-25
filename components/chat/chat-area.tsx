'use client'

import { useChat, type Message } from '@/hooks/use-chat'
import { useConversation, useConversations } from '@/hooks/use-conversations'
import { useSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	Bot,
	Check,
	ChevronDown,
	Copy,
	Pencil,
	RefreshCw,
	Square,
	ThumbsDown,
	ThumbsUp,
	X
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatInput } from './chat-input'
import { EmptyState } from './empty-state'
import { FeedbackModal } from './feedback-modal'
import { MarkdownRenderer } from './markdown-renderer'
import { TopBar } from './top-bar'

export function ChatArea() {
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messagesContainerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const [isNearBottom, setIsNearBottom] = useState(true)
	const [showScrollButton, setShowScrollButton] = useState(false)

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
			<div
				ref={messagesContainerRef}
				className="flex-1 overflow-y-auto relative w-full"
			>
				{messages.length > 0 ? (
					<div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
						{/* Messages */}
						{messages.map((message) => (
							<MessageBubble
								key={message.id}
								message={message}
								onRetry={handleRetry}
								onStop={stopGeneration}
								onEdit={handleEdit}
								isStreaming={isStreaming}
							/>
						))}

						{/* Scroll anchor */}
						<div ref={messagesEndRef} />
					</div>
				) : (
					<div className="h-full flex items-center justify-center max-w-3xl mx-auto px-6">
						<EmptyState />
					</div>
				)}
			</div>

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

			{/* Input Area */}
			<div className="w-full max-w-4xl mx-auto px-6 pb-6 relative z-10">
				<ChatInput
					ref={inputRef}
					onSendMessage={handleSendMessage}
					onStop={stopGeneration}
					isStreaming={isStreaming}
				/>
			</div>
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
}: MessageBubbleProps) {
	const isUser = message.role === 'user'
	const isAssistant = message.role === 'assistant'
	const [isEditing, setIsEditing] = useState(false)
	const [isExpanded, setIsExpanded] = useState(false)
	const [editContent, setEditContent] = useState(message.content)
	const [copied, setCopied] = useState(false)
	const [feedbackGiven, setFeedbackGiven] = useState<'good' | 'bad' | null>(null)
	const [showFeedbackModal, setShowFeedbackModal] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const { settings } = useSettings()

	// Check if message should be truncated
	const shouldTruncate = isUser && !isEditing && message.content.length > settings.messageTruncateLength
	const displayContent = shouldTruncate && !isExpanded 
		? message.content.slice(0, settings.messageTruncateLength) + '...'
		: message.content

	// Auto-resize textarea
	useEffect(() => {
		if (isEditing && textareaRef.current) {
			textareaRef.current.style.height = 'auto'
			textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
			textareaRef.current.focus()
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
				className={cn(
					'max-w-full rounded-2xl px-6 py-4 relative group overflow-hidden',
					isUser
						? 'bg-[#57FCFF]/10 border border-[#57FCFF]/20 ml-auto'
						: 'bg-[#1a2029]/50 border border-border/50',
					message.isError && 'border-destructive/50 bg-destructive/5'
				)}
			>
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
						<div className="space-y-2">
							<textarea
								ref={textareaRef}
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								onKeyDown={handleKeyDown}
								className="w-full min-h-[60px] bg-transparent border border-primary/30 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary resize-none"
								placeholder="Edit your message..."
							/>
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
							<div>
								<span className="whitespace-pre-wrap">{displayContent}</span>
								{shouldTruncate && (
									<button
										onClick={() => setIsExpanded(!isExpanded)}
										className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
									>
										{isExpanded ? 'Show less' : 'Show more'}
										<ChevronDown className={cn(
											'w-3 h-3 transition-transform',
											isExpanded && 'rotate-180'
										)} />
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
											<div className="font-medium mb-1">No response generated</div>
											<div className="text-xs opacity-70">
												The AI returned an empty response. This might be due to a network issue or API limitation.
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

				{/* Edit button for user messages */}
				{isUser && !isEditing && !isStreaming && (
					<button
						onClick={() => setIsEditing(true)}
						className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-background/50 hover:bg-background transition-all"
						title="Edit message"
					>
						<Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
					</button>
				)}

				{/* Error state with retry button */}
				{message.isError && !message.isStreaming && (
					<div className="mt-3 pt-3 border-t border-destructive/20 flex items-center gap-2">
						<AlertCircle className="w-4 h-4 text-destructive" />
						<span className="text-sm text-destructive">Failed to generate</span>
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

				{/* Action buttons for assistant messages */}
				{isAssistant && !message.isStreaming && message.content && (
					<div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-1">
						<button
							onClick={handleCopy}
							className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded transition-colors"
							title="Copy response"
						>
							{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
							{copied ? 'Copied' : 'Copy'}
						</button>
						<button
							onClick={() => handleFeedback('good')}
							disabled={feedbackGiven === 'good'}
							className={cn(
								"flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors",
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
								"flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors",
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
							className="ml-auto flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded transition-colors"
							title="Retry generation"
						>
							<RefreshCw className="w-3.5 h-3.5" />
							Retry
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
		</>
	)
}
