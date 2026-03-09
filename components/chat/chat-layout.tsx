'use client'

import { ChatArea } from './chat-area'
import { Sidebar } from './sidebar'

export function ChatLayout() {
	return (
		<div
			className="flex h-screen bg-background overflow-hidden"
		>
			{/* Left Sidebar - Fixed 280px */}
			<Sidebar />

			{/* Main Chat Area */}
			<ChatArea />
		</div>
	)
}
