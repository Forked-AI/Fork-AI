'use client'

import type { ReactNode } from 'react'
import { Sidebar } from './sidebar'

export function ChatShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<Sidebar />
			{children}
		</div>
	)
}
