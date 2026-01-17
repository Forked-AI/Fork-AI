'use client'

import { useEffect, useState } from 'react'
import { ChatInput } from './chat-input'
import { EmptyState } from './empty-state'
import { TopBar } from './top-bar'

interface ChatMessage {
	role: 'user' | 'assistant'
	content: string
}

interface LoadedChat {
	id: string
	title: string
	timestamp: string
	model: string
	messages: ChatMessage[]
}

export function ChatArea() {
	const [loadedChat, setLoadedChat] = useState<LoadedChat | null>(null)

	useEffect(() => {
		// Load chat from sessionStorage
		const loadChat = () => {
			const selectedChatData = sessionStorage.getItem('selectedChat')
			if (selectedChatData) {
				try {
					const chat = JSON.parse(selectedChatData)
					setLoadedChat(chat)
				} catch (error) {
					console.error('Failed to load chat:', error)
				}
			}
		}

		loadChat()

		// Listen for custom event to reload chat
		const handleChatChange = () => {
			loadChat()
		}

		window.addEventListener('chatChanged', handleChatChange)

		return () => {
			window.removeEventListener('chatChanged', handleChatChange)
		}
	}, [])

	return (
		<main
			className="flex-1 h-full relative flex flex-col overflow-hidden rounded-l-[29px]"
			style={{
				background: 'linear-gradient(180deg, #0A2727 0%, #0C1110 100%)',
			}}
		>
			{/* Static Blur Effect - Top Right (Requested by User/Figma) */}
			<div
				className="absolute top-[-68px] right-[46px] w-[373px] h-[373px] rounded-full bg-[#D9D9D9] opacity-[0.28] pointer-events-none"
				style={{ filter: 'blur(481.8px)' }}
			/>

			{/* Top Bar */}
			<TopBar />

			{/* Content Area - Centered for editorial readability */}
			<div className="flex-1 overflow-y-auto relative w-full">
				{loadedChat ? (
					<div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
						{/* Chat Header */}
						<div className="mb-8 pb-4 border-b border-[#57FCFF]/10">
							<h2 className="text-2xl font-serif text-foreground">{loadedChat.title}</h2>
							<p className="text-sm text-muted-foreground mt-1">
								{loadedChat.model} • {loadedChat.timestamp}
							</p>
						</div>

						{/* Messages */}
						{loadedChat.messages.map((message, index) => (
							<div
								key={index}
								className={`flex gap-4 ${
									message.role === 'user' ? 'justify-end' : 'justify-start'
								}`}
							>
								<div
									className={`max-w-[85%] rounded-2xl px-6 py-4 ${
										message.role === 'user'
											? 'bg-[#57FCFF]/10 border border-[#57FCFF]/20 ml-auto'
											: 'bg-[#1a2029]/50 border border-border/50'
									}`}
								>
								{message.role === 'assistant' && (
									<div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
										{loadedChat.model}
									</div>
								)}
									<p className="text-foreground leading-relaxed whitespace-pre-wrap">
										{message.content}
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="h-full flex items-center justify-center max-w-3xl mx-auto px-6">
						<EmptyState />
					</div>
				)}
			</div>

			{/* Input Area - Floats above with z-index to sit over blur if needed */}
			<div className="w-full max-w-4xl mx-auto px-6 pb-6 relative z-10">
				<ChatInput />
			</div>
		</main>
	)
}
