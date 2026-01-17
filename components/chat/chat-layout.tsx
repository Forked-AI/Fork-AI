'use client'

import { ChatArea } from './chat-area'
import { Sidebar } from './sidebar'

export function ChatLayout() {
	return (
		<div
			className="flex h-screen bg-background overflow-hidden"
			style={
				{
					// Premium Cyber-Editorial Theme Scoped Variables
					'--background': '#0a0d11',
					'--foreground': '#f0f4f8',
					'--card': '#11151a',
					'--card-foreground': '#f0f4f8',
					'--muted': '#1a2029',
					'--muted-foreground': '#94a3b8',
					'--border': '#242b36',
					'--sidebar': '#0a0d11',
					'--sidebar-foreground': '#f0f4f8',
					'--sidebar-border': '#242b36',
					'--sidebar-accent': '#1a2029',
					'--sidebar-accent-foreground': '#57FCFF',
					// The Signature Accent
					'--primary': '#57FCFF',
					'--primary-foreground': '#022c2d',
					'--ring': '#57FCFF',
				} as React.CSSProperties
			}
		>
			{/* Left Sidebar - Fixed 280px */}
			<Sidebar />

			{/* Main Chat Area */}
			<ChatArea />
		</div>
	)
}
