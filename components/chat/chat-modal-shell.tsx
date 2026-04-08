'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface ChatModalShellProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: ReactNode
	description?: ReactNode
	icon?: ReactNode
	backAction?: () => void
	headerTrailing?: ReactNode
	contentClassName?: string
	headerClassName?: string
	bodyClassName?: string
	titleClassName?: string
	descriptionClassName?: string
	children: ReactNode
	showCloseButton?: boolean
}

export function ChatModalShell({
	open,
	onOpenChange,
	title,
	description,
	icon,
	backAction,
	headerTrailing,
	contentClassName,
	headerClassName,
	bodyClassName,
	titleClassName,
	descriptionClassName,
	children,
	showCloseButton = true,
}: ChatModalShellProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={showCloseButton}
				className={cn('border border-primary/20 bg-popover', contentClassName)}
			>
				<DialogHeader className={cn('gap-4', headerClassName)}>
					<div className="flex items-start justify-between gap-4">
						<div className="flex min-w-0 flex-1 items-start gap-2">
							{backAction && (
								<Button
									variant="ghost"
									size="sm"
									onClick={backAction}
									className="h-8 w-8 p-0 hover:bg-primary/10"
								>
									<ArrowLeft className="h-4 w-4" />
								</Button>
							)}
							<div className="min-w-0 flex-1">
								<DialogTitle
									className={cn(
										'flex items-center gap-2 text-foreground',
										titleClassName
									)}
								>
									{icon}
									{title}
								</DialogTitle>
								{description ? (
									<DialogDescription
										className={cn(
											'mt-1 text-muted-foreground',
											descriptionClassName
										)}
									>
										{description}
									</DialogDescription>
								) : null}
							</div>
						</div>
						{headerTrailing ? (
							<div className="shrink-0 pt-1">{headerTrailing}</div>
						) : null}
					</div>
				</DialogHeader>

				<div className={cn('space-y-6 py-4', bodyClassName)}>{children}</div>
			</DialogContent>
		</Dialog>
	)
}
