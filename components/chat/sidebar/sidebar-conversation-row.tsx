'use client'

import { renderMenuActions, type MenuAction } from '@/components/chat/menu-action-renderer'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConversationPreview } from '@/hooks/use-conversations'
import { MoreVertical } from 'lucide-react'
import type { ConversationMenuSurface } from './use-sidebar-conversation-actions'

const MENU_CONTENT_CLASSNAME = 'bg-popover border-border/50 w-56'
const MENU_STYLES = {
	itemClassName: 'text-white hover:bg-white/10',
	destructiveItemClassName: 'text-red-400 hover:bg-red-500/10 hover:text-red-400',
	submenuContentClassName: 'bg-popover border-border/50',
}

interface SidebarConversationRowProps {
	conversation: ConversationPreview
	isActive: boolean
	isGeneratingTitle: boolean
	menuActions: MenuAction[]
	menuOpen: boolean
	onMenuOpenChange: (
		conversationId: string,
		surface: ConversationMenuSurface,
		open: boolean
	) => void
	onOpenConversation: (conversationId: string) => void
	timestampLabel: string
}

export function SidebarConversationRow({
	conversation,
	isActive,
	isGeneratingTitle,
	menuActions,
	menuOpen,
	onMenuOpenChange,
	onOpenConversation,
	timestampLabel,
}: SidebarConversationRowProps) {
	const conversationRow = (
		<div
			onClick={() => onOpenConversation(conversation.id)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					onOpenConversation(conversation.id)
				}
			}}
			className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors group hover:bg-sidebar-accent/30 ${
				isActive ? 'bg-sidebar-accent/50' : ''
			}`}
			role="button"
			tabIndex={0}
		>
			<div className="relative z-10 mt-0.5 flex-shrink-0">
				<div
					className={`h-1.5 w-1.5 rounded-full transition-colors ${
						isActive ? 'bg-primary' : 'bg-border group-hover:bg-foreground'
					}`}
				/>
			</div>
			<div className="min-w-0 flex-1">
				{isGeneratingTitle ? (
					<Skeleton className="mb-1 h-4 w-32" />
				) : (
					<div className="truncate text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
						{conversation.title}
					</div>
				)}
				<div className="mt-0.5 flex items-center gap-2">
					<span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
						{conversation.messageCount} msgs
					</span>
					<span className="text-[10px] text-muted-foreground/40">
						{timestampLabel}
					</span>
				</div>
			</div>
			<div className="flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
				<DropdownMenu
					open={menuOpen}
					onOpenChange={(open) =>
						onMenuOpenChange(conversation.id, 'dropdown', open)
					}
				>
					<DropdownMenuTrigger asChild>
						<button
							onClick={(event) => event.stopPropagation()}
							onPointerDown={(event) => event.stopPropagation()}
							className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground focus-visible:bg-sidebar-accent/50 focus-visible:text-foreground"
							aria-label={`More actions for ${conversation.title}`}
							type="button"
						>
							<MoreVertical className="h-3.5 w-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="right"
						align="start"
						sideOffset={10}
						className={MENU_CONTENT_CLASSNAME}
						onClick={(event) => event.stopPropagation()}
					>
						{renderMenuActions('dropdown', menuActions, MENU_STYLES)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	)

	return (
		<ContextMenu
			onOpenChange={(open) =>
				onMenuOpenChange(conversation.id, 'context', open)
			}
		>
			<ContextMenuTrigger asChild>{conversationRow}</ContextMenuTrigger>
			<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
				{renderMenuActions('context', menuActions, MENU_STYLES)}
			</ContextMenuContent>
		</ContextMenu>
	)
}
