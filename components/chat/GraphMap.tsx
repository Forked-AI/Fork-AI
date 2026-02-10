'use client'

import type { ChatGraph } from '@/lib/graph-adapter'
import * as api from '@/lib/graph-api'
import { applyAutoLayout, calculateTreeLayout } from '@/lib/graph-layout'
import { loadGraph, saveGraph, setConversationId } from '@/lib/graph-service'
import { isDescendant } from '@/lib/tree'
import { cn } from '@/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout as LayoutIcon } from 'lucide-react'
import type React from 'react'
import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react'
import GraphContextMenu from './GraphContextMenu'

interface GraphMapProps {
	conversationId: string
	selectedNodeIds: Set<string>
	onSelectNodes: Dispatch<SetStateAction<Set<string>>>
	searchQuery: string
	focusMode: boolean
	onAction: (action: string, id: string) => void
	showMinimap?: boolean
	attachMode?: string | null
	onAttachComplete?: (nodeId: string, targetId: string) => void
}

export default function GraphMap({
	conversationId,
	selectedNodeIds,
	onSelectNodes,
	searchQuery,
	focusMode,
	onAction,
	showMinimap,
	attachMode,
	onAttachComplete,
}: GraphMapProps) {
	const queryClient = useQueryClient()
	const containerRef = useRef<HTMLDivElement>(null)

	// Set conversation ID for graph service
	useEffect(() => {
		setConversationId(conversationId)
	}, [conversationId])

	// Viewport state
	const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
	const [isPanning, setIsPanning] = useState(false)
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
	const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
	const [contextMenu, setContextMenu] = useState<{
		x: number
		y: number
		nodeId: string
	} | null>(null)
	const dragOffset = useRef({ x: 0, y: 0 })

	// Local state for immediate drag feedback
	const [dragPos, setDragPos] = useState<{
		id: string
		x: number
		y: number
	} | null>(null)
	const [dropTargetId, setDropTargetId] = useState<string | null>(null)

	// Box selection state
	const [boxSelection, setBoxSelection] = useState<{
		start: { x: number; y: number }
		end: { x: number; y: number }
	} | null>(null)

	// Multi-noloadGraphfor all dragging nodes
	const [multiDragPos, setMultiDragPos] = useState<
		Map<string, { x: number; y: number }>
	>(new Map())

	const { data: graph = { id: conversationId, nodes: [] } as ChatGraph } =
		useQuery({
			queryKey: ['chatGraph', conversationId],
			queryFn: loadGraph,
		})

	// Apply auto-layout to nodes without positions
	const layoutedGraph: ChatGraph = useMemo(() => {
		if (!graph || graph.nodes.length === 0) {
			return graph
		}
		return {
			...graph,
			nodes: applyAutoLayout(graph.nodes),
		}
	}, [graph])

	// Auto-center viewport on graph nodes when first loaded
	useEffect(() => {
		if (layoutedGraph.nodes.length > 0 && containerRef.current) {
			// Calculate bounds of all nodes
			const xs = layoutedGraph.nodes.map((n) => n.x)
			const ys = layoutedGraph.nodes.map((n) => n.y)
			const minX = Math.min(...xs)
			const maxX = Math.max(...xs)
			const minY = Math.min(...ys)
			const maxY = Math.max(...ys)

			// Calculate center point
			const centerX = (minX + maxX) / 2
			const centerY = (minY + maxY) / 2

			// Get container dimensions
			const rect = containerRef.current.getBoundingClientRect()
			const viewportCenterX = rect.width / 2
			const viewportCenterY = rect.height / 2

			// Set transform to center the graph
			setTransform({
				x: viewportCenterX - centerX,
				y: viewportCenterY - centerY,
				scale: 1,
			})
		}
	}, [layoutedGraph.nodes.length]) // Only run when nodes are first loaded

	const updatePosition = useMutation({
		mutationFn: async (node: { id: string; x: number; y: number }) => {
			// Call API to persist position
			await api.updateNodePosition(node.id, node.x, node.y)

			// Update cache
			const currentGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])
			if (!currentGraph) {
				throw new Error('No graph data available')
			}
			const updated = {
				...currentGraph,
				nodes: currentGraph.nodes.map((n) =>
					n.id === node.id ? { ...n, x: node.x, y: node.y } : n
				),
			}
			return updated
		},
		onMutate: async (newNode) => {
			await queryClient.cancelQueries({
				queryKey: ['chatGraph', conversationId],
			})
			const previousGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])

			if (previousGraph) {
				queryClient.setQueryData<ChatGraph>(['chatGraph', conversationId], {
					...previousGraph,
					nodes: previousGraph.nodes.map((n) =>
						n.id === newNode.id ? { ...n, x: newNode.x, y: newNode.y } : n
					),
				})
			}
			return { previousGraph }
		},
		onError: (err, newNode, context) => {
			if (context?.previousGraph) {
				queryClient.setQueryData(
					['chatGraph', conversationId],
					context.previousGraph
				)
			}
		},
	})

	const attachNode = useMutation({
		mutationFn: async ({
			id,
			parentId,
		}: {
			id: string
			parentId: string | null
		}) => {
			// Call API to persist attachment
			await api.attachNodeToParent(id, parentId)

			// Update cache
			const currentGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])
			if (!currentGraph) {
				throw new Error('No graph data available')
			}
			const updated = {
				...currentGraph,
				nodes: currentGraph.nodes.map((n) =>
					n.id === id ? { ...n, replyTo: parentId } : n
				),
			}
			return updated
		},
		onMutate: async ({ id, parentId }) => {
			await queryClient.cancelQueries({
				queryKey: ['chatGraph', conversationId],
			})
			const previousGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])

			if (previousGraph) {
				const updatedGraph = {
					...previousGraph,
					nodes: previousGraph.nodes.map((n) =>
						n.id === id ? { ...n, replyTo: parentId } : n
					),
				}
				queryClient.setQueryData<ChatGraph>(
					['chatGraph', conversationId],
					updatedGraph
				)
			}
			return { previousGraph }
		},
		onError: (err, variables, context) => {
			if (context?.previousGraph) {
				queryClient.setQueryData(
					['chatGraph', conversationId],
					context.previousGraph
				)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['chatGraph', conversationId] })
		},
	})

	const duplicateNode = useMutation({
		mutationFn: async (id: string) => {
			// Get fresh data from React Query cache instead of using stale closure
			const currentGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])
			if (!currentGraph) {
				throw new Error('No graph data available')
			}
			const nodeToCopy = currentGraph.nodes.find((n) => n.id === id)
			if (!nodeToCopy) return currentGraph

			const newNode = {
				...nodeToCopy,
				id: crypto.randomUUID(),
				x: nodeToCopy.x + 30,
				y: nodeToCopy.y + 30,
				createdAt: Date.now(),
			}

			const updated = {
				...currentGraph,
				nodes: [...currentGraph.nodes, newNode],
			}
			saveGraph(updated)
			return updated
		},
		onSuccess: (data) =>
			queryClient.setQueryData(['chatGraph', conversationId], data),
	})

	const detachNode = useMutation({
		mutationFn: async (id: string) => {
			const currentGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])
			if (!currentGraph) {
				throw new Error('No graph data available')
			}
			const updated = {
				...currentGraph,
				nodes: currentGraph.nodes.map((n) =>
					n.id === id ? { ...n, replyTo: null } : n
				),
			}
			saveGraph(updated)
			return updated
		},
		onSuccess: (data) =>
			queryClient.setQueryData(['chatGraph', conversationId], data),
	})

	const deleteNode = useMutation({
		mutationFn: async (id: string) => {
			const currentGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])
			if (!currentGraph) {
				throw new Error('No graph data available')
			}
			const node = currentGraph.nodes.find((n) => n.id === id)
			// Delete node but keep its children, re-attaching them to this node's parent
			const updated = {
				...currentGraph,
				nodes: currentGraph.nodes
					.filter((n) => n.id !== id)
					.map((n) =>
						n.replyTo === id ? { ...n, replyTo: node?.replyTo || null } : n
					),
			}
			saveGraph(updated)
			return { updated, deletedId: id }
		},
		onSuccess: ({ updated, deletedId }) => {
			queryClient.setQueryData(['chatGraph', conversationId], updated)
			if (selectedNodeIds.has(deletedId)) {
				onSelectNodes(
					new Set(Array.from(selectedNodeIds).filter((id) => id !== deletedId))
				)
			}
		},
	})

	const deleteThread = useMutation({
		mutationFn: async (id: string) => {
			const currentGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])
			if (!currentGraph) {
				throw new Error('No graph data available')
			}
			// Helper function to get all node IDs in a subtree
			const getSubtreeIds = (
				nodes: typeof currentGraph.nodes,
				rootId: string
			): string[] => {
				const childrenMap = new Map<string, string[]>()
				nodes.forEach((node) => {
					if (node.replyTo) {
						const children = childrenMap.get(node.replyTo) || []
						children.push(node.id)
						childrenMap.set(node.replyTo, children)
					}
				})
				const ids: string[] = [rootId]
				const queue = [rootId]
				while (queue.length > 0) {
					const current = queue.shift()!
					const children = childrenMap.get(current) || []
					ids.push(...children)
					queue.push(...children)
				}
				return Array.from(new Set(ids))
			}

			const subtreeIds = getSubtreeIds(currentGraph.nodes, id)
			const updated = {
				...currentGraph,
				nodes: currentGraph.nodes.filter((n) => !subtreeIds.includes(n.id)),
			}
			saveGraph(updated)
			return { updated, deletedIds: subtreeIds }
		},
		onSuccess: ({ updated, deletedIds }) => {
			queryClient.setQueryData(['chatGraph', conversationId], updated)
			if (Array.from(selectedNodeIds).some((id) => deletedIds.includes(id))) {
				onSelectNodes(
					new Set(
						Array.from(selectedNodeIds).filter((id) => !deletedIds.includes(id))
					)
				)
			}
		},
	})

	const dropNode = useMutation({
		mutationFn: async ({
			id,
			parentId,
			x,
			y,
		}: {
			id: string
			parentId: string | null
			x: number
			y: number
		}) => {
			await api.attachAndUpdatePosition(id, parentId, x, y)

			const currentGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])
			if (!currentGraph) {
				throw new Error('No graph data available')
			}
			const updated = {
				...currentGraph,
				nodes: currentGraph.nodes.map((n) =>
					n.id === id ? { ...n, replyTo: parentId, x, y } : n
				),
			}
			return updated
		},
		onMutate: async ({ id, parentId, x, y }) => {
			await queryClient.cancelQueries({
				queryKey: ['chatGraph', conversationId],
			})
			const previousGraph = queryClient.getQueryData<ChatGraph>([
				'chatGraph',
				conversationId,
			])

			if (previousGraph) {
				const updatedGraph = {
					...previousGraph,
					nodes: previousGraph.nodes.map((n) =>
						n.id === id ? { ...n, replyTo: parentId, x, y } : n
					),
				}
				queryClient.setQueryData<ChatGraph>(
					['chatGraph', conversationId],
					updatedGraph
				)
			}
			return { previousGraph }
		},
		onError: (err, variables, context) => {
			if (context?.previousGraph) {
				queryClient.setQueryData(
					['chatGraph', conversationId],
					context.previousGraph
				)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['chatGraph', conversationId] })
		},
	})

	const nodeRelationships = useMemo(() => {
		const targetId = hoveredNodeId || Array.from(selectedNodeIds)[0] || null
		if (!targetId)
			return {
				parents: new Set<string>(),
				children: new Set<string>(),
				self: null,
			}

		const children = new Set<string>()
		const parents = new Set<string>()

		layoutedGraph.nodes.forEach((n) => {
			if (n.replyTo === targetId) children.add(n.id)
			if (n.id === targetId && n.replyTo) parents.add(n.replyTo)
		})

		return { parents, children, self: targetId }
	}, [layoutedGraph.nodes, hoveredNodeId, selectedNodeIds])

	const neighbors = useMemo(() => {
		const all = new Set<string>()
		if (nodeRelationships.self) all.add(nodeRelationships.self)
		nodeRelationships.parents.forEach((id) => all.add(id))
		nodeRelationships.children.forEach((id) => all.add(id))
		return all
	}, [nodeRelationships])

	const connectionCounts = useMemo(() => {
		const counts = new Map<string, number>()
		layoutedGraph.nodes.forEach((node) => {
			const childCount = layoutedGraph.nodes.filter(
				(n) => n.replyTo === node.id
			).length
			counts.set(node.id, childCount)
		})
		return counts
	}, [layoutedGraph.nodes])

	// Pan Handling
	const handlePointerDown = (e: React.PointerEvent) => {
		if (e.button !== 0) return
		const target = (e.target as HTMLElement).closest(
			'[data-node-id]'
		) as HTMLElement
		if (target) {
			const nodeId = target.dataset.nodeId
			if (!nodeId) return

			// Handle attach mode - clicking target node
			if (attachMode && attachMode !== nodeId) {
				e.preventDefault()
				e.stopPropagation()
				onAttachComplete?.(attachMode, nodeId)
				return
			}

			// Handle shift+click or ctrl/cmd+click for multi-select
			if (e.shiftKey || e.ctrlKey || e.metaKey) {
				e.preventDefault()
				e.stopPropagation()

				if (e.shiftKey) {
					// Shift+Click: Select range from nearest selected node to clicked node
					onSelectNodes((prev: Set<string>) => {
						const next = new Set(prev)
						const clickedNode = layoutedGraph.nodes.find((n) => n.id === nodeId)

						if (!clickedNode || prev.size === 0) {
							// No previous selection, just add this node
							next.add(nodeId)
							return next
						}

						// Find nearest selected node
						const selectedNodes = layoutedGraph.nodes.filter((n) =>
							prev.has(n.id)
						)
						let nearestNode = selectedNodes[0]
						let minDistance = Infinity

						for (const selNode of selectedNodes) {
							const distance = Math.sqrt(
								Math.pow(selNode.x - clickedNode.x, 2) +
									Math.pow(selNode.y - clickedNode.y, 2)
							)
							if (distance < minDistance) {
								minDistance = distance
								nearestNode = selNode
							}
						}

						// Create bounding box between nearest and clicked node
						const minX = Math.min(nearestNode.x, clickedNode.x)
						const maxX = Math.max(nearestNode.x, clickedNode.x)
						const minY = Math.min(nearestNode.y, clickedNode.y)
						const maxY = Math.max(nearestNode.y, clickedNode.y)

						// Select all nodes within the bounding box
						for (const node of layoutedGraph.nodes) {
							if (
								node.x >= minX &&
								node.x <= maxX &&
								node.y >= minY &&
								node.y <= maxY
							) {
								next.add(node.id)
							}
						}

						return next
					})
				} else {
					// Ctrl/Cmd+Click: Toggle node in selection
					onSelectNodes((prev: Set<string>) => {
						const next = new Set(prev)
						if (next.has(nodeId)) {
							next.delete(nodeId)
						} else {
							next.add(nodeId)
						}
						return next
					})
				}
				return // Don't start drag when modifier key held
			}

			// Normal click behavior - start drag
			setDraggingNodeId(nodeId)
			const node = layoutedGraph.nodes.find((n) => n.id === nodeId)
			if (node) {
				dragOffset.current = {
					x: e.clientX - (node.x * transform.scale + transform.x),
					y: e.clientY - (node.y * transform.scale + transform.y),
				}
			}

			// Replace selection with single node if not already selected
			if (!selectedNodeIds.has(nodeId)) {
				onSelectNodes(new Set([nodeId]))
			}
			// If already selected, keep multi-selection for multi-node drag

			;(e.target as HTMLElement).setPointerCapture(e.pointerId)
		} else {
			// Background click
			if (e.shiftKey) {
				// Start box selection
				const worldX = (e.clientX - transform.x) / transform.scale
				const worldY = (e.clientY - transform.y) / transform.scale
				setBoxSelection({
					start: { x: worldX, y: worldY },
					end: { x: worldX, y: worldY },
				})
			} else {
				// Start panning
				setIsPanning(true)
				onSelectNodes(new Set()) // Clear selection on background click
			}
			;(e.target as HTMLElement).setPointerCapture(e.pointerId)
		}
	}

	// Add ref for animation frame throttling
	const rafRef = useRef<number | null>(null)

	const handlePointerMove = (e: React.PointerEvent) => {
		// Extract event data since synthetic events are reused
		const { clientX, clientY, movementX, movementY } = e

		if (rafRef.current) return

		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null

			if (boxSelection) {
				// Update box selection end position
				const worldX = (clientX - transform.x) / transform.scale
				const worldY = (clientY - transform.y) / transform.scale
				setBoxSelection((prev) =>
					prev
						? {
								...prev,
								end: { x: worldX, y: worldY },
							}
						: null
				)

				// Select nodes within box
				const minX = Math.min(boxSelection.start.x, worldX)
				const maxX = Math.max(boxSelection.start.x, worldX)
				const minY = Math.min(boxSelection.start.y, worldY)
				const maxY = Math.max(boxSelection.start.y, worldY)

				const nodesInBox = layoutedGraph.nodes.filter(
					(node) =>
						node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
				)

				onSelectNodes(new Set(nodesInBox.map((n) => n.id)))
			} else if (isPanning) {
				setTransform((t) => ({
					...t,
					x: t.x + movementX,
					y: t.y + movementY,
				}))
			} else if (draggingNodeId) {
				const newX =
					(clientX - transform.x - dragOffset.current.x) / transform.scale
				const newY =
					(clientY - transform.y - dragOffset.current.y) / transform.scale

				// Check if dragging multiple nodes
				if (selectedNodeIds.size > 1 && selectedNodeIds.has(draggingNodeId)) {
					// Multi-node drag - calculate offset from primary dragged node
					const primaryNode = layoutedGraph.nodes.find(
						(n) => n.id === draggingNodeId
					)
					if (primaryNode) {
						const deltaX = newX - primaryNode.x
						const deltaY = newY - primaryNode.y

						// Update positions for all selected nodes
						const newPositions = new Map<string, { x: number; y: number }>()
						selectedNodeIds.forEach((nodeId) => {
							const node = layoutedGraph.nodes.find((n) => n.id === nodeId)
							if (node) {
								newPositions.set(nodeId, {
									x: node.x + deltaX,
									y: node.y + deltaY,
								})
							}
						})
						setMultiDragPos(newPositions)
					}
				} else {
					// Single node drag
					setDragPos({ id: draggingNodeId, x: newX, y: newY })
					setMultiDragPos(new Map())
				}

				const target = layoutedGraph.nodes.find((n) => {
					if (n.id === draggingNodeId) return false
					const dx = n.x - newX
					const dy = n.y - newY
					return Math.sqrt(dx * dx + dy * dy) < 100
				})

				if (target?.id !== dropTargetId) {
					setDropTargetId(target?.id || null)
				}
			}
		})
	}

	// TODO: Remove sequential await - combine into single mutation using attachAndUpdatePosition from graphService for production
	// TODO: Remove sequential await - combine into single mutation using attachAndUpdatePosition from graphService for production
	const handlePointerUp = async (e: React.PointerEvent) => {
		const currentNodeId = draggingNodeId
		const currentDragPos = dragPos
		const currentDropTargetId = dropTargetId
		const currentMultiDragPos = multiDragPos

		// Release pointer capture immediately
		if (
			e.target instanceof Element &&
			e.target.hasPointerCapture(e.pointerId)
		) {
			e.target.releasePointerCapture(e.pointerId)
		}

		// Clear state immediately to prevent "sticking" to cursor
		setIsPanning(false)
		setDraggingNodeId(null)
		setDragPos(null)
		setDropTargetId(null)
		setBoxSelection(null)
		setMultiDragPos(new Map())

		if (currentNodeId) {
			// Handle multi-node drag
			if (currentMultiDragPos.size > 0) {
				// Update positions for all dragged nodes
				for (const [nodeId, pos] of currentMultiDragPos.entries()) {
					await updatePosition.mutateAsync({ id: nodeId, x: pos.x, y: pos.y })
				}
			} else if (currentDragPos) {
				// Single node drag
				if (
					currentDropTargetId &&
					!isDescendant(layoutedGraph.nodes, currentNodeId, currentDropTargetId)
				) {
					// Use atomic drop + move
					await dropNode.mutateAsync({
						id: currentNodeId,
						parentId: currentDropTargetId,
						x: currentDragPos.x,
						y: currentDragPos.y,
					})
				} else {
					// Just move
					await updatePosition.mutateAsync({
						id: currentNodeId,
						x: currentDragPos.x,
						y: currentDragPos.y,
					})
				}
			}
		}
	}

	const handleWheel = (e: React.WheelEvent) => {
		const delta = e.deltaY * -0.001
		const newScale = Math.min(Math.max(transform.scale + delta, 0.2), 3)

		const rect = containerRef.current?.getBoundingClientRect()
		if (!rect) return

		const mouseX = e.clientX - rect.left
		const mouseY = e.clientY - rect.top

		const dx = (mouseX - transform.x) / transform.scale
		const dy = (mouseY - transform.y) / transform.scale

		setTransform({
			scale: newScale,
			x: mouseX - dx * newScale,
			y: mouseY - dy * newScale,
		})
	}

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault()
		const target = e.target as HTMLElement
		if (target.dataset.nodeId) {
			setContextMenu({
				x: e.clientX,
				y: e.clientY,
				nodeId: target.dataset.nodeId,
			})
		}
	}

	// Keyboard shortcuts for multi-select
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Escape - clear selection
			if (e.key === 'Escape') {
				onSelectNodes(new Set())
				setBoxSelection(null)
			}

			// Ctrl/Cmd+A - select all nodes
			if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
				e.preventDefault()
				onSelectNodes(new Set(layoutedGraph.nodes.map((n) => n.id)))
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [layoutedGraph.nodes, onSelectNodes])

	const handleOrganize = async () => {
		if (!graph) return

		// Recalculate layout for ALL nodes based on tree structure
		// This ignores current positions and resets to a clean hierarchy
		const positions = calculateTreeLayout(graph.nodes)

		const updates = Array.from(positions.entries()).map(([id, pos]) => ({
			id,
			positionX: pos.x,
			positionY: pos.y,
		}))

		// Optimistic update
		queryClient.setQueryData<ChatGraph>(
			['chatGraph', conversationId],
			(old) => {
				if (!old) return old
				return {
					...old,
					nodes: old.nodes.map((n) => {
						const pos = positions.get(n.id)
						return pos ? { ...n, x: pos.x, y: pos.y } : n
					}),
				}
			}
		)

		// Persist changes
		try {
			await api.batchUpdatePositions(updates)
		} catch (error) {
			console.error('Failed to organize graph:', error)
			// Revert on error (invalidate query to refetch fresh state)
			queryClient.invalidateQueries({ queryKey: ['chatGraph', conversationId] })
		}
	}

	const handleAction = (action: string) => {
		if (!contextMenu) return
		const id = contextMenu.nodeId

		switch (action) {
			case 'detach':
				detachNode.mutate(id)
				break
			case 'duplicate':
				duplicateNode.mutate(id)
				break
			case 'delete-node':
				deleteNode.mutate(id)
				break
			case 'delete-thread':
				deleteThread.mutate(id)
				break
			case 'attach':
				// TODO: Implement attach mode where user can click another node to attach to
				console.log('Attach mode not yet implemented')
				break
			case 'branch':
				// Trigger branch creation from this message
				onAction('branch', id)
				break
			default:
				// Fall back to parent handler for unknown actions
				onAction(action, id)
		}

		setContextMenu(null)
	}

	return (
		<div
			ref={containerRef}
			className={`relative w-full h-full overflow-hidden ${
				attachMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
			}`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onWheel={handleWheel}
			onContextMenu={handleContextMenu}
		>
			<div className="graph-vignette" />

			<div className="absolute top-4 left-4 z-30 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs space-y-2">
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
					<span className="text-foreground/80">Selected / Hovered</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_12px_rgba(139,92,246,0.6)]" />
					<span className="text-foreground/80">Connected (Parent/Child)</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-secondary" />
					<span className="text-foreground/80">Unrelated</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full ring-4 ring-accent animate-pulse" />
					<span className="text-foreground/80">Drop Target</span>
				</div>
			</div>

			{/* Selection Counter */}
			{selectedNodeIds.size > 0 && (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-accent/90 backdrop-blur-sm border border-accent rounded-full px-4 py-2 text-xs font-bold text-white shadow-lg">
					{selectedNodeIds.size} node{selectedNodeIds.size !== 1 ? 's' : ''}{' '}
					selected
					<span className="ml-2 text-xs opacity-75">(ESC to clear)</span>
				</div>
			)}

			<div
				className="absolute inset-0 origin-top-left"
				style={{
					transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
				}}
			>
				<svg
					className="absolute top-0 left-0 pointer-events-none overflow-visible"
					style={{ width: '100%', height: '100%' }}
				>
					<defs>
						<style>
							{`
								@keyframes dash {
									to {
										stroke-dashoffset: -20;
									}
								}
								.animate-dash {
									animation: dash 1s linear infinite;
								}
							`}
						</style>
						<marker
							id="arrowhead"
							markerWidth="8"
							markerHeight="8"
							refX="6"
							refY="3"
							orient="auto"
							markerUnits="strokeWidth"
						>
							<path d="M0,0 L0,6 L6,3 z" fill="#71717a" opacity="0.8" />
						</marker>
						<marker
							id="arrowhead-highlight"
							markerWidth="10"
							markerHeight="10"
							refX="7"
							refY="4"
							orient="auto"
							markerUnits="strokeWidth"
						>
							<path d="M0,0 L0,8 L8,4 z" fill="#3b82f6" opacity="0.9" />
						</marker>
						<filter id="edge-glow">
							<feGaussianBlur stdDeviation="2" result="blur" />
							<feComposite in="SourceGraphic" in2="blur" operator="over" />
						</filter>
					</defs>

					{layoutedGraph.nodes
						.filter(
							(node, index, self) =>
								index === self.findIndex((n) => n.id === node.id)
						) // Dedup
						.map((node) => {
							// Check multi-drag first, then single drag, then original position
							const multiPos = multiDragPos.get(node.id)
							const currentPos =
								multiPos || (dragPos?.id === node.id ? dragPos : node)
							const parent = layoutedGraph.nodes.find(
								(p) => p.id === node.replyTo
							)
							const multiParentPos = parent ? multiDragPos.get(parent.id) : null
							const parentPos = parent
								? multiParentPos ||
									(dragPos?.id === parent.id ? dragPos : parent)
								: null

							if (!parentPos) return null
							const isHighlighted =
								neighbors.has(node.id) && neighbors.has(parent!.id)
							const pathData = `M ${parentPos.x} ${parentPos.y} C ${
								parentPos.x
							} ${(parentPos.y + currentPos.y) / 2}, ${currentPos.x} ${
								(parentPos.y + currentPos.y) / 2
							}, ${currentPos.x} ${currentPos.y}`

							return (
								<g key={`edge-group-${node.id}`}>
									<path
										d={pathData}
										stroke={isHighlighted ? '#3b82f6' : '#71717a'}
										strokeWidth={isHighlighted ? 3 : 2}
										fill="none"
										opacity={isHighlighted ? 1 : 0.6}
										style={{ transition: draggingNodeId ? 'none' : 'all 0.3s' }}
										markerEnd={
											isHighlighted
												? 'url(#arrowhead-highlight)'
												: 'url(#arrowhead)'
										}
										filter={isHighlighted ? 'url(#edge-glow)' : 'none'}
									/>
									{/* Always render animated path but control opacity */}
									<path
										d={pathData}
										stroke="#3b82f6"
										strokeWidth={2}
										fill="none"
										strokeDasharray="8 8"
										className={cn(
											'animate-dash transition-opacity duration-300',
											isHighlighted ? 'opacity-100' : 'opacity-0'
										)}
									/>
								</g>
							)
						})}

					{draggingNodeId && dropTargetId && dragPos && (
						<>
							<path
								d={`M ${layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.x} ${
									layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.y
								} C ${layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.x} ${
									(layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.y +
										dragPos.y) /
									2
								}, ${dragPos.x} ${
									(layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.y +
										dragPos.y) /
									2
								}, ${dragPos.x} ${dragPos.y}`}
								stroke="var(--accent)"
								strokeWidth={4}
								fill="none"
								opacity={0.4}
								filter="blur(3px)"
							/>
							<path
								d={`M ${layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.x} ${
									layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.y
								} C ${layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.x} ${
									(layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.y +
										dragPos.y) /
									2
								}, ${dragPos.x} ${
									(layoutedGraph.nodes.find((n) => n.id === dropTargetId)!.y +
										dragPos.y) /
									2
								}, ${dragPos.x} ${dragPos.y}`}
								stroke="var(--accent)"
								strokeWidth={3}
								strokeDasharray="10 5"
								fill="none"
								opacity={1}
								className="animate-pulse"
								markerEnd="url(#arrowhead-highlight)"
							/>
						</>
					)}

					{/* Box Selection Overlay */}
					{boxSelection && (
						<rect
							x={Math.min(boxSelection.start.x, boxSelection.end.x)}
							y={Math.min(boxSelection.start.y, boxSelection.end.y)}
							width={Math.abs(boxSelection.end.x - boxSelection.start.x)}
							height={Math.abs(boxSelection.end.y - boxSelection.start.y)}
							fill="var(--accent)"
							fillOpacity={0.1}
							stroke="var(--accent)"
							strokeWidth={2 / transform.scale}
							strokeDasharray={`${5 / transform.scale} ${5 / transform.scale}`}
							pointerEvents="none"
						/>
					)}
				</svg>

				{layoutedGraph.nodes.map((node) => {
					// Check multi-drag position first, then single drag, then original position
					const multiPos = multiDragPos.get(node.id)
					const displayX = multiPos
						? multiPos.x
						: dragPos?.id === node.id
							? dragPos.x
							: node.x
					const displayY = multiPos
						? multiPos.y
						: dragPos?.id === node.id
							? dragPos.y
							: node.y
					const isSelected = selectedNodeIds.has(node.id)
					const isHovered = hoveredNodeId === node.id
					const isTarget = dropTargetId === node.id
					const isParent = nodeRelationships.parents.has(node.id)
					const isChild = nodeRelationships.children.has(node.id)
					const isHighlighted =
						neighbors.has(node.id) ||
						node.text.toLowerCase().includes(searchQuery.toLowerCase())
					const isDimmed = focusMode && !isHighlighted
					const childCount = connectionCounts.get(node.id) || 0

					return (
						<div
							key={node.id}
							data-node-id={node.id}
							className={cn(
								'absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer group transition-all duration-300 ease-out',
								isSelected && 'ring-2 ring-white scale-125 z-20',
								isTarget && 'ring-[6px] ring-accent scale-110 z-20',
								!isSelected && !isTarget && 'z-10',
								isDimmed ? 'opacity-10 scale-50' : 'opacity-100',
								node.role === 'user'
									? 'bg-white'
									: node.role === 'assistant'
										? 'bg-accent'
										: 'bg-secondary'
							)}
							style={{
								left: displayX,
								top: displayY,
								width: 24,
								height: 24,
								boxShadow:
									isSelected || isHovered
										? '0 0 30px rgba(255,255,255,0.9), 0 0 60px rgba(255,255,255,0.5)'
										: isHighlighted
											? '0 0 20px rgba(139,92,246,0.6), 0 0 40px rgba(139,92,246,0.3)'
											: '0 0 8px rgba(0,0,0,0.3)',
							}}
							onPointerEnter={() => setHoveredNodeId(node.id)}
							onPointerLeave={() => setHoveredNodeId(null)}
						>
							{childCount > 0 && (
								<div className="absolute -top-1 -right-1 w-3 h-3 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center z-10 shadow-sm border border-background">
									{childCount}
								</div>
							)}

							{(transform.scale > 0.6 ||
								isSelected ||
								neighbors.has(node.id)) && (
								<span
									className={cn(
										'absolute left-8 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium pointer-events-none uppercase tracking-widest transition-all duration-200',
										isSelected || isHovered
											? 'text-foreground'
											: 'text-foreground/60 group-hover:text-foreground'
									)}
								>
									{isParent && '↑ '}
									{isChild && '↓ '}
									{node.text.slice(0, 30)}...
								</span>
							)}

							{isTarget && (
								<div className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-75" />
							)}
						</div>
					)
				})}
			</div>

			{/* Controls & Minimap Container */}
			<div className="absolute top-4 right-4 flex flex-col items-end gap-2">
				{/* Organize Button */}
				<button
					onClick={handleOrganize}
					className="bg-background/90 backdrop-blur border border-border rounded-lg p-2 shadow-lg hover:bg-accent hover:text-white transition-colors group"
					title="Organize Graph (Reset Layout)"
				>
					<LayoutIcon className="w-5 h-5 text-foreground/80 group-hover:text-white" />
				</button>

				{/* Minimap */}
				{showMinimap && layoutedGraph.nodes.length > 0 && (
					<div className="bg-background/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
						<div className="text-[9px] font-bold uppercase tracking-widest text-secondary mb-2">
							Map
						</div>
						<svg width={200} height={150} className="overflow-visible">
							{(() => {
								// Calculate bounding box
								const padding = 100
								const xs = layoutedGraph.nodes.map((n) => n.x)
								const ys = layoutedGraph.nodes.map((n) => n.y)
								const minX = Math.min(...xs) - padding
								const maxX = Math.max(...xs) + padding
								const minY = Math.min(...ys) - padding
								const maxY = Math.max(...ys) + padding

								const width = maxX - minX
								const height = maxY - minY
								const scale = Math.min(200 / width, 150 / height)

								return (
									<>
										{/* Connection lines */}
										{layoutedGraph.nodes.map((node) => {
											if (!node.replyTo) return null
											const parent = layoutedGraph.nodes.find(
												(n) => n.id === node.replyTo
											)
											if (!parent) return null
											return (
												<line
													key={`line-${node.id}`}
													x1={(parent.x - minX) * scale}
													y1={(parent.y - minY) * scale}
													x2={(node.x - minX) * scale}
													y2={(node.y - minY) * scale}
													className="stroke-muted stroke-1"
												/>
											)
										})}

										{/* Nodes */}
										{layoutedGraph.nodes.map((node) => (
											<circle
												key={node.id}
												cx={(node.x - minX) * scale}
												cy={(node.y - minY) * scale}
												r={selectedNodeIds.has(node.id) ? 5 : 3}
												className={
													selectedNodeIds.has(node.id)
														? 'fill-accent'
														: 'fill-muted hover:fill-accent/50'
												}
											/>
										))}

										{/* Viewport indicator */}
										<rect
											x={Math.max(
												0,
												(-transform.x / transform.scale - minX) * scale
											)}
											y={Math.max(
												0,
												(-transform.y / transform.scale - minY) * scale
											)}
											width={Math.min(
												200,
												(window.innerWidth / transform.scale) * scale
											)}
											height={Math.min(
												150,
												(window.innerHeight / transform.scale) * scale
											)}
											className="fill-none stroke-accent stroke-2 opacity-50"
										/>
									</>
								)
							})()}
						</svg>
					</div>
				)}
			</div>
			{contextMenu && (
				<GraphContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					nodeId={contextMenu.nodeId}
					onClose={() => setContextMenu(null)}
					onAction={handleAction}
				/>
			)}
		</div>
	)
}
