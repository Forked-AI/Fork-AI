'use client'

import { ShareModal } from '@/components/chat/share-modal'
import { Plus, Share2, UserCircle } from 'lucide-react'
import { useState } from 'react'

interface TopBarProps {
	onNewChat?: () => void
	title?: string | null
	onRename?: (newTitle: string) => void
}

export function TopBar({ onNewChat, title, onRename }: TopBarProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [editTitle, setEditTitle] = useState('')
	const [shareOpen, setShareOpen] = useState(false)

	// Initialize edit title when entering edit mode
	const startEditing = () => {
		if (title) {
			setEditTitle(title)
			setIsEditing(true)
		}
	}

	const handleSave = () => {
		if (onRename && editTitle.trim()) {
			onRename(editTitle.trim())
		}
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleSave()
		} else if (e.key === 'Escape') {
			setIsEditing(false)
		}
	}

	return (
		<>
			<header className="h-16 px-6 flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
				{/* Left - New Chat Button */}
				<div className="flex items-center gap-2">
					{onNewChat && (
						<button
							onClick={onNewChat}
							className="group flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-card/50 border border-border/50 rounded-lg hover:border-primary/50 transition-all hover:shadow-[0_0_10px_-3px_var(--primary)]"
						>
							<Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
							<span>New Chat</span>
						</button>
					)}
				</div>

				{/* Center - Editable Title */}
				<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[40%] w-full flex justify-center">
					{isEditing ? (
						<input
							autoFocus
							value={editTitle}
							onChange={(e) => setEditTitle(e.target.value)}
							onBlur={handleSave}
							onKeyDown={handleKeyDown}
							className="w-full max-w-[240px] text-center bg-transparent border-b border-primary/50 text-sm font-medium focus:outline-none py-1"
							placeholder="Chat Title..."
						/>
					) : (
						<button
							onClick={startEditing}
							disabled={!title}
							className="text-sm font-medium text-foreground/90 hover:text-primary transition-colors truncate max-w-full px-2 py-1 rounded hover:bg-white/5"
						>
							{title || (
								<span className="text-muted-foreground italic">
									New Conversation
								</span>
							)}
						</button>
					)}
				</div>

				{/* Right - Actions */}
				<div className="flex items-center gap-4">
					<button
						onClick={() => setShareOpen(true)}
						className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider group"
					>
						<Share2 className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
						<span className="hidden sm:inline">Share</span>
					</button>
					<div className="w-px h-3 bg-border" />
					<button className="text-muted-foreground hover:text-foreground transition-colors">
						<UserCircle className="w-5 h-5 stroke-[1.5]" />
					</button>
				</div>
			</header>

			<ShareModal open={shareOpen} onOpenChange={setShareOpen} />
		</>
	)
}
