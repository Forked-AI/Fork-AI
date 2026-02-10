'use client'

import { ArrowRight, Copy, LinkIcon, Trash2, Unlink, X } from 'lucide-react'
import React from 'react'

import type { ChatGraph, GraphNode as ChatNode } from '@/lib/graph-adapter'
import { getAncestors, buildChildMap as getChildrenMap } from '@/lib/tree'

interface InspectorPanelProps {
	selectedNodeIds: Set<string>
	selectedNodes: ChatNode[]
	graph: ChatGraph
	onClose: () => void
	onSelectNode: (id: string) => void
	onAction: (action: string, nodeId: string) => void
	attachMode?: string | null
	onStartAttach?: (nodeId: string) => void
}

export default function InspectorPanel({
	selectedNodeIds,
	selectedNodes,
	graph,
	onClose,
	onSelectNode,
	onAction,
	attachMode,
	onStartAttach,
}: InspectorPanelProps) {
	if (selectedNodes.length === 0) return null

	// Single node selection - show full details
	if (selectedNodes.length === 1) {
		const selectedNode = selectedNodes[0]

		const ancestors = getAncestors(graph.nodes, selectedNode.id)
		const childrenMap = getChildrenMap(graph.nodes)
		const childrenIds = childrenMap.get(selectedNode.id) || []
		const childrenNodes = graph.nodes.filter((n) => childrenIds.includes(n.id))

		return (
			<div className="absolute top-0 right-0 w-96 h-full bg-background/80 backdrop-blur-xl border-l border-border z-30 flex flex-col custom-scrollbar overflow-y-auto">
				<div className="p-6 flex items-center justify-between border-b border-border">
					<div>
						<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
							{selectedNode.role}
						</span>
						<p className="text-xs text-secondary mt-1">
							{new Date(selectedNode.createdAt).toLocaleString()}
						</p>
					</div>
					<button
						onClick={onClose}
						className="p-2 hover:bg-muted rounded-full transition-colors"
					>
						<X size={18} />
					</button>
				</div>

				<div className="p-6 space-y-8 flex-1">
					{ancestors.length > 0 && (
						<div className="space-y-3">
							<h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
								Path
							</h3>
							<div className="flex flex-wrap gap-2 items-center">
								{ancestors.map((node, i) => (
									<React.Fragment key={node.id}>
										<button
											onClick={() => onSelectNode(node.id)}
											className="text-[11px] hover:text-white transition-colors underline decoration-border underline-offset-4"
										>
											{node.text?.slice(0, 15) || 'Unknown'}...
										</button>
										{i < ancestors.length - 1 && (
											<ArrowRight size={12} className="text-muted" />
										)}
									</React.Fragment>
								))}
							</div>
						</div>
					)}

					<div className="space-y-3">
						<h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
							Message
						</h3>
						<div className="text-sm leading-relaxed font-serif text-foreground/90 whitespace-pre-wrap selection:bg-accent/30">
							{selectedNode.text || 'No content'}
						</div>
					</div>

					{childrenNodes.length > 0 && (
						<div className="space-y-3">
							<h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
								Branches
							</h3>
							<div className="grid gap-2">
								{childrenNodes.map((node) => (
									<button
										key={node.id}
										onClick={() => onSelectNode(node.id)}
										className="text-left p-3 rounded-lg border border-border hover:border-accent transition-all text-xs group"
									>
										<span className="block text-secondary text-[10px] uppercase mb-1">
											{node.role}
										</span>
										<span className="line-clamp-2 group-hover:text-white">
											{node.text || 'No content'}
										</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="p-6 grid grid-cols-2 gap-3 border-t border-border">
					<button
						onClick={() => onStartAttach?.(selectedNode.id)}
						className={`flex items-center gap-2 px-4 py-2 transition-colors rounded-md text-[11px] font-bold uppercase tracking-widest ${
							attachMode === selectedNode.id
								? 'bg-accent text-white'
								: 'bg-muted hover:bg-border'
						}`}
					>
						<LinkIcon size={14} />{' '}
						{attachMode === selectedNode.id ? 'Click Target' : 'Attach'}
					</button>
					<button
						onClick={() => onAction('duplicate', selectedNode.id)}
						className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border transition-colors rounded-md text-[11px] font-bold uppercase tracking-widest"
					>
						<Copy size={14} /> Duplicate
					</button>
					{selectedNode.replyTo && (
						<button
							onClick={() => onAction('detach', selectedNode.id)}
							className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-muted hover:bg-border transition-colors rounded-md text-[11px] font-bold uppercase tracking-widest"
						>
							<Unlink size={14} /> Detach Node
						</button>
					)}
					<button
						onClick={() => onAction('delete-thread', selectedNode.id)}
						className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 border border-red-900/50 hover:bg-red-950/30 transition-colors rounded-md text-[11px] font-bold uppercase tracking-widest text-red-400"
					>
						<Trash2 size={14} /> Delete Thread
					</button>
				</div>
			</div>
		)
	}

	// Multi-node selection - show summary and batch actions
	return (
		<div className="absolute top-0 right-0 w-96 h-full bg-background/80 backdrop-blur-xl border-l border-border z-30 flex flex-col custom-scrollbar overflow-y-auto">
			<div className="p-6 flex items-center justify-between border-b border-border">
				<div>
					<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
						Multi-Select
					</span>
					<p className="text-xs text-secondary mt-1">
						{selectedNodes.length} nodes selected
					</p>
				</div>
				<button
					onClick={onClose}
					className="p-2 hover:bg-muted rounded-full transition-colors"
				>
					<X size={18} />
				</button>
			</div>

			<div className="flex-1 p-6 space-y-4">
				<div className="text-xs text-secondary">
					<p className="font-bold mb-2">Selected Nodes:</p>
					<div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
						{selectedNodes.map((node) => (
							<button
								key={node.id}
								onClick={() => onSelectNode(node.id)}
								className="w-full text-left px-3 py-2 bg-muted/50 hover:bg-muted rounded-md transition-colors"
							>
								<div className="font-medium text-foreground">{node.role}</div>
								<div className="text-[10px] text-secondary truncate">
									{node.text}
								</div>
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="p-6 grid grid-cols-2 gap-3 border-t border-border">
				<button
					onClick={() => {
						selectedNodeIds.forEach((id) => onAction('duplicate', id))
					}}
					className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border transition-colors rounded-md text-[11px] font-bold uppercase tracking-widest"
				>
					<Copy size={14} /> Duplicate All
				</button>
				<button
					onClick={() => {
						selectedNodeIds.forEach((id) => onAction('detach', id))
					}}
					className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border transition-colors rounded-md text-[11px] font-bold uppercase tracking-widest"
				>
					<Unlink size={14} /> Detach All
				</button>
				<button
					onClick={() => {
						selectedNodeIds.forEach((id) => onAction('delete-node', id))
					}}
					className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 border border-red-900/50 hover:bg-red-950/30 transition-colors rounded-md text-[11px] font-bold uppercase tracking-widest text-red-400"
				>
					<Trash2 size={14} /> Delete All Nodes
				</button>
			</div>
		</div>
	)
}
