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
	type ChatAttachmentInput,
	type ChatEnabledTool,
	type Message,
	type MessageHistoryEntry,
} from '@/hooks/use-chat'
import { useConversation, useConversations } from '@/hooks/use-conversations'
import { useMessageTree } from '@/hooks/use-message-tree'
import { useSettings } from '@/hooks/use-settings'
import {
	activeSkillFromInstalled,
	type ActiveChatSkill,
	type ConversationSkillBindingView,
	useConversationSkills,
	useSkillActions,
} from '@/hooks/use-skills'
import { AlertCircle, Reply, X } from 'lucide-react'
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
	ragFileIds: string[]
	attachments: ChatAttachmentInput[]
	activeSkills: ActiveChatSkill[]
	enabledTools: ChatEnabledTool[]
	createdAt: Date
}

interface SelectionRect {
	left: number
	top: number
	right: number
	bottom: number
	width: number
	height: number
}

interface QuoteSelection {
	messageId: string
	text: string
	rect: SelectionRect
	position: {
		x: number
		y: number
	}
	useBottomBar: boolean
}

const SELECTION_TOOLBAR_WIDTH = 132
const SELECTION_TOOLBAR_HEIGHT = 36
const MOBILE_SELECTION_BREAKPOINT = 640

function clamp(value: number, min: number, max: number) {
	if (max < min) return min
	return Math.min(Math.max(value, min), max)
}

function snapshotRect(rect: DOMRect): SelectionRect {
	return {
		left: rect.left,
		top: rect.top,
		right: rect.right,
		bottom: rect.bottom,
		width: rect.width,
		height: rect.height,
	}
}

const EMPTY_CONVERSATION_SKILL_BINDINGS: ConversationSkillBindingView[] = []

function areActiveSkillsEqual(
	left: ActiveChatSkill[],
	right: ActiveChatSkill[]
) {
	if (left.length !== right.length) return false

	return left.every((skill, index) => {
		const other = right[index]
		return (
			other &&
			skill.installedSkillId === other.installedSkillId &&
			skill.templateId === other.templateId &&
			skill.versionId === other.versionId &&
			skill.title === other.title &&
			skill.scope === other.scope &&
			skill.riskLevel === other.riskLevel &&
			skill.bindingId === other.bindingId &&
			skill.requiredTools.length === other.requiredTools.length &&
			skill.requiredTools.every((tool, toolIndex) => {
				return tool === other.requiredTools[toolIndex]
			})
		)
	})
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

function calculateSelectionToolbarPosition(
	rect: SelectionRect,
	container: HTMLElement | null
) {
	const useBottomBar = window.innerWidth < MOBILE_SELECTION_BREAKPOINT
	const containerRect = container?.getBoundingClientRect()
	const bounds = containerRect ?? {
		left: 0,
		top: 0,
		right: window.innerWidth,
		bottom: window.innerHeight,
	}

	const x = clamp(
		rect.left + rect.width / 2,
		bounds.left + SELECTION_TOOLBAR_WIDTH / 2 + 12,
		bounds.right - SELECTION_TOOLBAR_WIDTH / 2 - 12
	)
	const preferredTop = rect.top - SELECTION_TOOLBAR_HEIGHT - 8
	const fallbackTop = rect.bottom + 8
	const unclampedY =
		preferredTop >= bounds.top + 12 ? preferredTop : fallbackTop
	const y = clamp(
		unclampedY,
		bounds.top + 12,
		bounds.bottom - SELECTION_TOOLBAR_HEIGHT - 12
	)

	return {
		position: { x, y },
		useBottomBar,
	}
}

function readActiveQuoteSelection(container: HTMLElement) {
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

	const messageId = messageContent.dataset.messageId
	const rect = getRangeRect(range)

	if (!messageId || !rect) {
		return null
	}

	return {
		messageId,
		text,
		rect,
	}
}

export function ChatArea() {
	const router = useRouter()
	const { startTitleGeneration, finishTitleGeneration } = useChatUI()
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const selectionReplyToolbarRef = useRef<HTMLDivElement>(null)
	const editHandlersRef = useRef<Map<string, () => void>>(new Map())
	const messagesRef = useRef<Message[]>([])
	const previousIsStreamingRef = useRef(false)
	const selectedConversationIdRef = useRef<string | null>(null)
	const activeSendParentMessageIdRef = useRef<string | null>(null)
	const activeSendHistoryRef = useRef<MessageHistoryEntry[]>([])
	const queuedMessagesRef = useRef<QueuedMessage[]>([])
	const activeSkillsRef = useRef<ActiveChatSkill[]>([])
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
	const [activeSkills, setActiveSkills] = useState<ActiveChatSkill[]>([])
	const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle')
	const [quoteSelection, setQuoteSelection] = useState<QuoteSelection | null>(
		null
	)
	const [quoteInsertion, setQuoteInsertion] = useState<{
		id: string
		text: string
	} | null>(null)
	const [selectedReplyContext, setSelectedReplyContext] = useState<{
		messageId: string
		text: string
	} | null>(null)

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
		data: conversationSkillBindings = EMPTY_CONVERSATION_SKILL_BINDINGS,
	} = useConversationSkills(conversationId)
	const { unbindConversationSkill } = useSkillActions(conversationId)

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
	activeSkillsRef.current = activeSkills

	useEffect(() => {
		if (!conversationId) {
			setActiveSkills((current) => {
				const next = current.filter((skill) => skill.scope === 'turn')
				return areActiveSkillsEqual(current, next) ? current : next
			})
			return
		}

		const conversationSkills = conversationSkillBindings.map((binding) =>
			activeSkillFromInstalled(
				binding.installedSkill,
				'conversation',
				binding.id
			)
		)

		setActiveSkills((current) => {
			const turnSkills = current.filter((skill) => skill.scope === 'turn')
			const next = [...conversationSkills, ...turnSkills]
			return areActiveSkillsEqual(current, next) ? current : next
		})
	}, [conversationId, conversationSkillBindings])

	const handleActivateSkill = useCallback((skill: ActiveChatSkill) => {
		setActiveSkills((current) => {
			const withoutDuplicate = current.filter(
				(existing) =>
					existing.installedSkillId !== skill.installedSkillId ||
					existing.scope !== skill.scope
			)
			return [...withoutDuplicate, skill]
		})
	}, [])

	const handleRemoveActiveSkill = useCallback(
		(installedSkillId: string) => {
			const target = activeSkillsRef.current.find(
				(skill) => skill.installedSkillId === installedSkillId
			)
			setActiveSkills((current) =>
				current.filter((skill) => skill.installedSkillId !== installedSkillId)
			)
			if (target?.bindingId) {
				void unbindConversationSkill(target.bindingId)
			}
		},
		[unbindConversationSkill]
	)

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
			ragFileIds: string[],
			attachments: ChatAttachmentInput[],
			activeSkills: ActiveChatSkill[],
			enabledTools: ChatEnabledTool[],
			anchorMessageId: string | null,
			anchorHistory: MessageHistoryEntry[]
		) => {
			const queuedMessage: QueuedMessage = {
				id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				content,
				model,
				ragFileIds,
				attachments,
				activeSkills,
				enabledTools,
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
					history,
					nextQueuedMessage.ragFileIds,
					nextQueuedMessage.attachments,
					nextQueuedMessage.activeSkills.map((skill) => ({
						installedSkillId: skill.installedSkillId,
						scope: skill.scope,
					})),
					nextQueuedMessage.enabledTools
				)

				if (queueStatusRef.current !== 'running') {
					return
				}

				if (result.status === 'done') {
					setQueueTailMessageId(result.assistantMessageId)
					setQueueHistory(await readHistorySnapshot(result.assistantMessageId))
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
		setQueueHistory,
		setQueueStatusState,
		setQueueTailMessageId,
		setQueuedMessagesState,
	])

	const hasQueuedWork = queuedMessages.length > 0 || queueStatus === 'halted'

	const clearQuoteSelection = useCallback(() => {
		setQuoteSelection(null)
	}, [])

	const clearSelectedReplyContext = useCallback(() => {
		setSelectedReplyContext(null)
	}, [])

	const handleBranchFromMessage = useCallback(
		(messageId: string) => {
			if (hasQueuedWork) {
				return
			}
			clearSelectedReplyContext()
			setBranchFromMessageId(messageId)
			scrollToMessage(messageId)
		},
		[clearSelectedReplyContext, hasQueuedWork, scrollToMessage]
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
		clearBranchContext: () => {
			setBranchFromMessageId(null)
			clearSelectedReplyContext()
		},
		onFocusMessage: scrollToMessage,
		onRequireSignIn: () => setShowSignInModal(true),
		onStartBranch: handleBranchFromMessage,
	})

	useEffect(() => {
		if (!showGraphView) return

		clearQuoteSelection()
	}, [clearQuoteSelection, showGraphView])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.key === 'i') {
				event.preventDefault()
				inputRef.current?.focus()
			}

			if (event.key === 'Escape') {
				clearQuoteSelection()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [clearQuoteSelection])

	useEffect(() => {
		if (!quoteSelection) return

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target
			if (
				target instanceof Node &&
				selectionReplyToolbarRef.current?.contains(target)
			) {
				return
			}

			clearQuoteSelection()
		}

		window.addEventListener('pointerdown', handlePointerDown)
		return () => window.removeEventListener('pointerdown', handlePointerDown)
	}, [clearQuoteSelection, quoteSelection])

	const updateQuoteSelectionPlacement = useCallback(() => {
		const container = messagesContainerRef.current
		if (!container) {
			clearQuoteSelection()
			return
		}

		const activeSelection = readActiveQuoteSelection(container)
		if (!activeSelection) {
			clearQuoteSelection()
			return
		}

		setQuoteSelection((currentSelection) => {
			if (
				!currentSelection ||
				currentSelection.messageId !== activeSelection.messageId
			) {
				return currentSelection
			}

			const rect = snapshotRect(activeSelection.rect)
			const placement = calculateSelectionToolbarPosition(rect, container)
			return {
				...currentSelection,
				text: activeSelection.text,
				rect,
				...placement,
			}
		})
	}, [clearQuoteSelection, messagesContainerRef])

	useEffect(() => {
		if (!quoteSelection) return

		window.addEventListener('resize', updateQuoteSelectionPlacement)
		return () =>
			window.removeEventListener('resize', updateQuoteSelectionPlacement)
	}, [quoteSelection, updateQuoteSelectionPlacement])

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
			(pendingConversationId &&
				selectedConversationId === pendingConversationId)
		) {
			return
		}

		clearQueuedState()
		setQuoteSelection(null)
		clearSelectedReplyContext()
	}, [
		clearQueuedState,
		clearSelectedReplyContext,
		pendingConversationId,
		selectedConversationId,
	])

	const handleQuoteSelection = useCallback(
		(selection: { messageId: string; text: string; rect: DOMRect }) => {
			if (hasQueuedWork) {
				return
			}

			const rect = snapshotRect(selection.rect)
			const placement = calculateSelectionToolbarPosition(
				rect,
				messagesContainerRef.current
			)

			setQuoteSelection({
				messageId: selection.messageId,
				text: selection.text,
				rect,
				...placement,
			})
		},
		[hasQueuedWork, messagesContainerRef]
	)

	const handleReplyToSelection = useCallback(() => {
		if (!quoteSelection || hasQueuedWork) {
			return
		}

		setQuoteInsertion({
			id: `${quoteSelection.messageId}-${Date.now()}`,
			text: quoteSelection.text,
		})
		setBranchFromMessageId(quoteSelection.messageId)
		setSelectedReplyContext({
			messageId: quoteSelection.messageId,
			text: quoteSelection.text,
		})
		clearQuoteSelection()
		window.getSelection()?.removeAllRanges()
	}, [clearQuoteSelection, hasQueuedWork, quoteSelection])

	const handleSendMessage = useCallback(
		async (
			content: string,
			model: string,
			attachments: ChatAttachmentInput[] = [],
			requestActiveSkills = activeSkillsRef.current,
			enabledTools: ChatEnabledTool[] = []
		) => {
			const branchId = branchFromMessageId
			const parentMessageId = branchId ?? displayedMessages.at(-1)?.id ?? null
			const history: MessageHistoryEntry[] = displayedMessages
				.filter(
					(message): message is typeof message & MessageHistoryEntry =>
						message.role === 'user' || message.role === 'assistant'
				)
				.map(({ role, content }) => ({
					role,
					content,
				}))

			if (branchId) {
				setBranchFromMessageId(null)
				clearSelectedReplyContext()
			}

			if (
				isStreaming ||
				queuedMessagesRef.current.length > 0 ||
				queueStatusRef.current === 'halted'
			) {
				enqueueMessage(
					content,
					model,
					attachments
						.filter((attachment) => attachment.promptUse !== 'vision')
						.map((attachment) => attachment.fileObjectId),
					attachments,
					requestActiveSkills,
					enabledTools,
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

				if (requestActiveSkills.some((skill) => skill.scope === 'turn')) {
					setActiveSkills((current) =>
						current.filter((skill) => skill.scope !== 'turn')
					)
				}

				return
			}

			activeSendParentMessageIdRef.current = parentMessageId
			activeSendHistoryRef.current = history

			const result = await sendMessage(
				content,
				model,
				parentMessageId,
				history,
				attachments
					.filter((attachment) => attachment.promptUse !== 'vision')
					.map((attachment) => attachment.fileObjectId),
				attachments,
				requestActiveSkills.map((skill) => ({
					installedSkillId: skill.installedSkillId,
					scope: skill.scope,
				})),
				enabledTools
			)

			if (requestActiveSkills.some((skill) => skill.scope === 'turn')) {
				setActiveSkills((current) =>
					current.filter((skill) => skill.scope !== 'turn')
				)
			}

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
			clearSelectedReplyContext,
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
		clearSelectedReplyContext()
	}, [clearSelectedReplyContext, hasQueuedWork])

	const handleNewChat = useCallback(() => {
		setPendingConversationId(null)
		handleStopGeneration()
		clearMessages()
		setQuoteSelection(null)
		clearSelectedReplyContext()
		handleDeselectAllMessages()
		router.replace('/chat', { scroll: false })
	}, [
		clearMessages,
		clearSelectedReplyContext,
		handleDeselectAllMessages,
		handleStopGeneration,
		router,
	])

	const branchContext = useMemo(() => {
		if (!branchFromMessageId) {
			return null
		}

		if (selectedReplyContext?.messageId === branchFromMessageId) {
			return {
				messageId: branchFromMessageId,
				preview: selectedReplyContext.text,
				kind: 'selected-reply' as const,
			}
		}

		return {
			messageId: branchFromMessageId,
			preview:
				messages
					.find((message) => message.id === branchFromMessageId)
					?.content.slice(0, 80) ?? '',
			kind: 'branch' as const,
		}
	}, [branchFromMessageId, messages, selectedReplyContext])

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
					onQuoteSelection={handleQuoteSelection}
					onScroll={updateQuoteSelectionPlacement}
				/>
			) : null}

			{quoteSelection && !quoteSelection.useBottomBar ? (
				<div
					ref={selectionReplyToolbarRef}
					className="fixed z-50 hidden items-center gap-1.5 rounded-lg border border-primary/30 bg-[#111820]/95 px-3 py-1.5 text-xs font-medium text-primary shadow-lg shadow-black/20 backdrop-blur transition-colors hover:bg-primary/10 sm:inline-flex"
					style={{
						left: quoteSelection.position.x,
						top: quoteSelection.position.y,
						transform: 'translateX(-50%)',
					}}
				>
					<button
						type="button"
						onMouseDown={(event) => event.preventDefault()}
						onClick={handleReplyToSelection}
						className="inline-flex items-center gap-1.5"
						aria-label="Reply to selection"
						title="Reply to selection"
					>
						<Reply className="h-3.5 w-3.5" />
						Reply
					</button>
				</div>
			) : null}

			{quoteSelection && quoteSelection.useBottomBar ? (
				<div
					ref={selectionReplyToolbarRef}
					className="fixed inset-x-3 bottom-28 z-50 rounded-xl border border-primary/25 bg-[#111820]/95 p-2 shadow-2xl shadow-black/30 backdrop-blur sm:hidden"
				>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleReplyToSelection}
							className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
							aria-label="Reply to selection"
							title="Reply to selection"
						>
							<Reply className="h-4 w-4" />
							<span>Reply to selected text</span>
						</button>
						<button
							type="button"
							onClick={clearQuoteSelection}
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
							aria-label="Cancel selected text reply"
							title="Cancel"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
					<p className="mt-2 truncate px-1 text-xs text-muted-foreground">
						{quoteSelection.text}
					</p>
				</div>
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
						conversationId={conversationId}
						activeSkills={activeSkills}
						onActivateSkill={handleActivateSkill}
						onRemoveActiveSkill={handleRemoveActiveSkill}
						queuedMessages={queuedMessages}
						queueStatus={queueStatus}
						onRemoveQueuedMessage={handleRemoveQueuedMessage}
						onClearQueue={handleClearQueue}
						onResumeQueue={handleResumeQueue}
						branchContext={branchContext}
						onClearBranchContext={handleClearBranchContext}
						quoteInsertion={quoteInsertion}
						onFocus={clearQuoteSelection}
					/>
				</div>
			) : null}
		</main>
	)
}
