'use client'

import { type Message } from '@/hooks/use-chat'
import { useCallback, useMemo, useState } from 'react'

function mapGraphNode(message: Message) {
	return {
		id: message.id,
		role: message.role,
		text: message.content,
		replyTo: message.parentMessageId ?? null,
		parentMessageId: message.parentMessageId ?? null,
		x: 0,
		y: 0,
		createdAt: message.createdAt
			? new Date(message.createdAt).getTime()
			: Date.now(),
		model: message.model ?? null,
		isError: message.isError ?? false,
	}
}

interface UseChatAreaGraphOptions {
	messages: Message[]
	isAuthenticated: boolean
	interactionsLocked: boolean
	clearBranchContext: () => void
	onFocusMessage: (messageId: string) => void
	onRequireSignIn: () => void
	onStartBranch: (messageId: string) => void
}

export function useChatAreaGraph({
	messages,
	isAuthenticated,
	interactionsLocked,
	clearBranchContext,
	onFocusMessage,
	onRequireSignIn,
	onStartBranch,
}: UseChatAreaGraphOptions) {
	const [showGraphView, setShowGraphView] = useState(false)
	const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
	const [attachMode, setAttachMode] = useState<string | null>(null)

	const graphNodes = useMemo(() => messages.map(mapGraphNode), [messages])
	const selectedNodes = useMemo(
		() => graphNodes.filter((node) => selectedNodeIds.has(node.id)),
		[graphNodes, selectedNodeIds]
	)

	const toggleGraphView = useCallback(() => {
		if (!showGraphView) {
			clearBranchContext()
		}
		setShowGraphView((current) => !current)
	}, [clearBranchContext, showGraphView])

	const openGraphView = useCallback(() => {
		clearBranchContext()
		setShowGraphView(true)
	}, [clearBranchContext])

	const handleGraphAction = useCallback(
		(action: string, nodeId?: string) => {
			switch (action) {
				case 'delete':
					if (nodeId) {
						console.log('Delete node:', nodeId)
					}
					break
				case 'branch':
					if (nodeId) {
						if (interactionsLocked) {
							return
						}
						if (!isAuthenticated) {
							onRequireSignIn()
							return
						}
						onStartBranch(nodeId)
						setShowGraphView(false)
						onFocusMessage(nodeId)
					}
					break
				case 'focus':
					if (nodeId) {
						setShowGraphView(false)
						onFocusMessage(nodeId)
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
					}
					break
				default:
					console.log('Graph action:', action, nodeId)
			}
		},
		[
			interactionsLocked,
			isAuthenticated,
			onFocusMessage,
			onRequireSignIn,
			onStartBranch,
		]
	)

	const handleStartAttach = useCallback((nodeId: string) => {
		setAttachMode('attach')
		console.log('Start attach from:', nodeId)
	}, [])

	const handleAttachComplete = useCallback(
		(sourceId: string, targetId: string) => {
			console.log('Attach complete:', sourceId, '->', targetId)
			setAttachMode(null)
		},
		[]
	)

	return {
		attachMode,
		graphNodes,
		handleAttachComplete,
		handleGraphAction,
		handleStartAttach,
		selectedNodeIds,
		selectedNodes,
		setSelectedNodeIds,
		showGraphView,
		openGraphView,
		toggleGraphView,
	}
}
