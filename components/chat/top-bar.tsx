'use client'

import { ShareModal } from '@/components/chat/share-modal'
import { useAuth } from '@/contexts/auth-context'
import type { Message } from '@/hooks/use-chat'
import { GitBranch, LogOut, Plus, Share2, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface TopBarProps {
	onNewChat?: () => void
	title?: string | null
	onRename?: (newTitle: string) => void
	onToggleGraph?: () => void
	showGraphView?: boolean
	messages?: Message[]
}

export function TopBar({
	onNewChat,
	title,
	onRename,
	onToggleGraph,
	showGraphView,
	messages = [],
}: TopBarProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [editTitle, setEditTitle] = useState('')
	const [shareOpen, setShareOpen] = useState(false)
	const [showUserMenu, setShowUserMenu] = useState(false)
	const { user, logout } = useAuth()

	// Handle logout
	const handleLogout = async () => {
		setShowUserMenu(false)
		await logout()
	}

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
					{onToggleGraph && (
						<>
							<button
								onClick={onToggleGraph}
								className={`flex items-center gap-2 text-xs font-medium transition-colors uppercase tracking-wider group ${
									showGraphView
										? 'text-primary hover:text-primary/80'
										: 'text-muted-foreground hover:text-foreground'
								}`}
								title={showGraphView ? 'Show Chat View' : 'Show Graph View'}
							>
								<GitBranch
									className={`w-3.5 h-3.5 transition-colors ${
										showGraphView ? 'text-primary' : 'group-hover:text-primary'
									}`}
								/>
								<span className="hidden sm:inline">Graph</span>
							</button>
							<div className="w-px h-3 bg-border" />
						</>
					)}
					<button
						onClick={() => setShareOpen(true)}
						className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider group"
					>
						<Share2 className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
						<span className="hidden sm:inline">Share</span>
					</button>
					<div className="w-px h-3 bg-border" />

					{/* User Menu or Sign In */}
					{user ? (
						<div className="relative">
							<button
								onClick={() => setShowUserMenu(!showUserMenu)}
								className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
							>
								<UserCircle className="w-5 h-5 stroke-[1.5]" />
								<span className="text-xs font-medium hidden sm:inline">
									{user.name || user.email}
								</span>
							</button>

							{/* User Dropdown Menu */}
							{showUserMenu && (
								<>
									<div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
										<div className="px-3 py-2 border-b border-border">
											<p className="text-sm font-medium text-foreground">
												{user.name}
											</p>
											<p className="text-xs text-muted-foreground">
												{user.email}
											</p>
										</div>
										<button
											onClick={handleLogout}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
										>
											<LogOut className="w-4 h-4" />
											Sign Out
										</button>
									</div>

									{/* Click outside to close menu */}
									<div
										className="fixed inset-0 z-40"
										onClick={() => setShowUserMenu(false)}
									/>
								</>
							)}
						</div>
					) : (
						<Link href="/login">
							<button className="group flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-card/50 border border-border/50 rounded-lg hover:border-primary/50 transition-all hover:shadow-[0_0_10px_-3px_var(--primary)]">
								<UserCircle className="w-3.5 h-3.5" />
								<span>Sign In</span>
							</button>
						</Link>
					)}
				</div>
			</header>

			<ShareModal
				open={shareOpen}
				onOpenChange={setShareOpen}
				messages={messages}
				conversationTitle={title || 'Untitled Conversation'}
			/>
		</>
	)
}
