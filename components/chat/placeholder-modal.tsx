'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import type { LucideIcon } from 'lucide-react'

interface PlaceholderModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	icon: LucideIcon
}

export function PlaceholderModal({
	open,
	onOpenChange,
	title,
	description,
	icon: Icon,
}: PlaceholderModalProps) {
	return (
		<ChatModalShell
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			icon={<Icon className="h-5 w-5 text-[#57FCFF]" />}
			contentClassName="sm:max-w-md"
		>
			<div className="py-8 text-center">
				<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border border-border/50 bg-sidebar">
					<Icon className="h-8 w-8 text-muted-foreground" />
				</div>
				<h3 className="mb-2 text-lg font-medium text-foreground">Coming Soon</h3>
				<p className="mx-auto max-w-xs text-sm text-muted-foreground">
					This feature is currently under development and will be available in
					an upcoming release.
				</p>
			</div>
		</ChatModalShell>
	)
}
