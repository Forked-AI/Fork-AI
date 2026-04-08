'use client'

import type { ReactNode } from 'react'

interface SidebarConversationSectionProps<TConversation> {
	title: string
	conversations: TConversation[]
	emptyState?: ReactNode
	renderRow: (conversation: TConversation) => ReactNode
}

export function SidebarConversationSection<TConversation>({
	title,
	conversations,
	emptyState,
	renderRow,
}: SidebarConversationSectionProps<TConversation>) {
	if (conversations.length === 0 && !emptyState) {
		return null
	}

	return (
		<div className="relative">
			<h3 className="mb-3 px-3 font-sans text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
				{title}
			</h3>
			{conversations.length > 0 ? (
				<div className="absolute bottom-0 left-[23px] top-[32px] w-[1px] bg-border/40" />
			) : null}
			<div className="relative space-y-1">
				{conversations.length > 0 ? conversations.map(renderRow) : emptyState}
			</div>
		</div>
	)
}
