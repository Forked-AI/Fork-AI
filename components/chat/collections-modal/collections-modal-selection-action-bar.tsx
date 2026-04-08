'use client'

import { Button } from '@/components/ui/button'
import { Folder, Trash2 } from 'lucide-react'

interface CollectionsModalSelectionActionBarProps {
	selectedCount: number
	onMove: () => void
	onDelete: () => void
}

export function CollectionsModalSelectionActionBar({
	selectedCount,
	onMove,
	onDelete,
}: CollectionsModalSelectionActionBarProps) {
	if (selectedCount === 0) return null

	return (
		<div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/30 bg-popover px-4 py-3 shadow-2xl">
			<span className="font-medium text-white">
				{selectedCount} chat{selectedCount !== 1 ? 's' : ''} selected
			</span>
			<div className="h-6 w-px bg-white/20" />
			<Button
				size="sm"
				onClick={onMove}
				className="bg-[#57FCFF] text-black hover:bg-[#57FCFF]/80"
			>
				<Folder className="mr-2 h-4 w-4" />
				Move
			</Button>
			<Button size="sm" variant="destructive" onClick={onDelete}>
				<Trash2 className="mr-2 h-4 w-4" />
				Delete
			</Button>
		</div>
	)
}
