'use client'

import type { ReactNode } from 'react'
import { RecentChatSwitcher } from './recent-chat-switcher'
import { Sidebar } from './sidebar'

export function ChatShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<Sidebar />
			<RecentChatSwitcher />
			{children}
		</div>
	)
}
