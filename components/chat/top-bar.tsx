'use client'

import { ShareModal } from '@/components/chat/share-modal'
import { ChevronDown, Share2, UserCircle } from 'lucide-react'
import { useState } from 'react'

export function TopBar() {
	const [isOpen, setIsOpen] = useState(false)
	const [shareOpen, setShareOpen] = useState(false)

	return (
		<>
			<header className="h-16 px-6 flex items-center justify-between sticky top-0 z-20">
				{/* Left - Model Selector (Editorial Style) */}
				<div className="relative">
					{/* <button
						onClick={() => setIsOpen(!isOpen)}
						className="flex items-center gap-2 text-sm font-serif font-medium text-foreground hover:text-foreground/80 transition-colors group"
					>
						<span className="tracking-tight">ChatGPT 5 (Preview)</span>
						<ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
					</button> */}
				</div>

				{/* Right - Actions */}
				<div className="flex items-center gap-4">
					<button
						onClick={() => setShareOpen(true)}
						className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
					>
						<Share2 className="w-3.5 h-3.5" />
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
