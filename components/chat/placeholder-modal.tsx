'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { LucideIcon } from 'lucide-react'

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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0a0d11]/80 backdrop-blur-xl border border-[#57FCFF]/20 sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-foreground flex items-center gap-2">
						<Icon className="w-5 h-5 text-[#57FCFF]" />
						{title}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{description}
					</DialogDescription>
				</DialogHeader>

				<div className="py-8 text-center">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sidebar border border-border/50 mb-4">
						<Icon className="w-8 h-8 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-medium text-foreground mb-2">Coming Soon</h3>
					<p className="text-sm text-muted-foreground max-w-xs mx-auto">
						This feature is currently under development and will be available in an upcoming release.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	)
}
