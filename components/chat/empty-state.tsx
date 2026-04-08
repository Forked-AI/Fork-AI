'use client'

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Sparkles } from 'lucide-react'

export function EmptyState() {
	return (
		<Empty className="animate-in slide-in-from-bottom-4 border-0 bg-transparent p-0 shadow-none duration-1000">
			<EmptyHeader className="gap-0">
				<div className="group relative mb-6 cursor-default">
					<div className="absolute inset-0 rounded-full bg-primary/20 opacity-10 blur-[40px]" />
					<EmptyMedia
						variant="default"
						className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-background shadow-2xl transition-colors group-hover:border-primary/50"
					>
						<Sparkles className="h-10 w-10 text-primary" />
					</EmptyMedia>
				</div>
				<EmptyTitle className="text-4xl font-bold tracking-tight text-foreground">
					FORK AI
				</EmptyTitle>
				<EmptyDescription className="mt-2 text-sm font-mono uppercase tracking-[0.3em] text-muted-foreground/60">
					Ready to create
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}
