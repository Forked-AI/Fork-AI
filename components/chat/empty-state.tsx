'use client'

import { Sparkles } from 'lucide-react'

export function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
			{/* Fork AI Brand Mark - Restored from Figma */}
			<div className="mb-12 relative group cursor-default">
				<div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full opacity-10" />
				<div className="relative flex items-center justify-center w-20 h-20 bg-background border border-border rounded-2xl shadow-2xl mb-6 mx-auto group-hover:border-primary/50 transition-colors">
					<Sparkles className="w-10 h-10 text-primary" />
				</div>
				<h1 className="text-4xl font-bold tracking-tight text-foreground">
					FORK AI
				</h1>
				<p className="mt-2 text-muted-foreground text-sm tracking-widest uppercase font-mono opacity-60">
					Ready to create
				</p>
			</div>
		</div>
	)
}
