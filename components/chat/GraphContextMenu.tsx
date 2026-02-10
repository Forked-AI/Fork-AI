'use client'

import { Copy, GitBranch, LinkIcon, Trash2, Unlink } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ContextMenuProps {
	x: number
	y: number
	nodeId: string
	onClose: () => void
	onAction: (action: string) => void
}

export default function ContextMenu({
	x,
	y,
	nodeId,
	onClose,
	onAction,
}: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose()
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [onClose])

	return (
		<div
			ref={menuRef}
			className="fixed z-50 min-w-48 bg-background/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-1"
			style={{ left: x, top: y }}
		>
			<button
				onClick={() => onAction('attach')}
				className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:bg-muted rounded-md transition-all group"
			>
				<LinkIcon size={14} className="text-gray-400 group-hover:text-white" />{' '}
				Attach to...
			</button>
			<button
				onClick={() => onAction('detach')}
				className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:bg-muted rounded-md transition-all group"
			>
				<Unlink size={14} className="text-gray-400 group-hover:text-white" />{' '}
				Detach
			</button>
			<button
				onClick={() => onAction('duplicate')}
				className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:bg-muted rounded-md transition-all group"
			>
				<Copy size={14} className="text-gray-400 group-hover:text-white" />{' '}
				Duplicate...
			</button>
			<button
				onClick={() => {
					onAction('branch')
					onClose()
				}}
				className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-accent-foreground hover:text-white hover:bg-accent/20 rounded-md transition-all group"
			>
				<GitBranch size={14} className="text-accent group-hover:text-white" />{' '}
				Branch from Here
			</button>

			<div className="h-px bg-border my-1" />

			<div className="relative group/delete">
				<button className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-all">
					<span className="flex items-center gap-3">
						<Trash2 size={14} className="text-red-400" /> Delete
					</span>
					<span className="text-[8px]">▶</span>
				</button>

				{/* Invisible bridge to keep hover active */}
				<div className="hidden group-hover/delete:block absolute left-full top-0 w-2 h-full" />

				<div className="hidden group-hover/delete:block absolute left-full top-0 ml-2 bg-background/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-1 min-w-40">
					<button
						onClick={() => onAction('delete-thread')}
						className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:bg-muted rounded-md transition-all"
					>
						Delete Thread
					</button>
					<button
						onClick={() => onAction('delete-node')}
						className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:bg-muted rounded-md transition-all"
					>
						Keep Replies
					</button>
				</div>
			</div>
		</div>
	)
}
