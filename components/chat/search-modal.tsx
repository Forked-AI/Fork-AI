'use client'

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog'
import { History } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface SearchModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface ChatMessage {
	role: 'user' | 'assistant'
	content: string
}

interface Chat {
	id: string
	title: string
	timestamp: string
	model: string
	messages: ChatMessage[]
}

const recentChats: Chat[] = [
	{
		id: '1',
		title: 'Project Phoenix',
		timestamp: '2h ago',
		model: 'GPT-4',
		messages: [
			{ role: 'user', content: 'Can you help me design the architecture for Project Phoenix?' },
			{ role: 'assistant', content: 'I\'d be happy to help with Project Phoenix architecture. Let\'s start by understanding the core requirements. What type of application are you building?' },
			{ role: 'user', content: 'It\'s a real-time collaboration platform with document editing.' },
			{ role: 'assistant', content: 'Great! For a real-time collaboration platform, I recommend a microservices architecture with WebSocket connections for real-time updates...' },
		],
	},
	{
		id: '2',
		title: 'Editorial Layouts',
		timestamp: '5h ago',
		model: 'Claude-3.5',
		messages: [
			{ role: 'user', content: 'I need help creating editorial layouts for a magazine website.' },
			{ role: 'assistant', content: 'Editorial layouts require a balance of typography, white space, and visual hierarchy. Let\'s explore some modern approaches...' },
			{ role: 'user', content: 'What about grid systems?' },
			{ role: 'assistant', content: 'Grid systems are fundamental to editorial design. I recommend using CSS Grid with a 12-column layout for maximum flexibility...' },
		],
	},
	{
		id: '3',
		title: 'Typography Study',
		timestamp: '1d ago',
		model: 'Gemini',
		messages: [
			{ role: 'user', content: 'What are the best practices for web typography?' },
			{ role: 'assistant', content: 'Web typography is crucial for readability and user experience. Here are the key principles: 1) Use a modular scale for font sizing, 2) Maintain proper line height (1.5-1.6 for body text)...' },
		],
	},
	{
		id: '4',
		title: 'API Design Discussion',
		timestamp: '2d ago',
		model: 'GPT-4',
		messages: [
			{ role: 'user', content: 'How should I structure a REST API for a social platform?' },
			{ role: 'assistant', content: 'For a social platform REST API, you\'ll want to follow RESTful conventions while considering scalability. Let\'s design the main endpoints...' },
			{ role: 'user', content: 'What about authentication?' },
			{ role: 'assistant', content: 'For authentication, I recommend using JWT tokens with refresh token rotation for security...' },
		],
	},
	{
		id: '5',
		title: 'Database Schema Review',
		timestamp: '3d ago',
		model: 'Claude-3.5',
		messages: [
			{ role: 'user', content: 'Can you review my database schema for an e-commerce platform?' },
			{ role: 'assistant', content: 'I\'d be happy to review your e-commerce database schema. Please share the current structure and I\'ll provide feedback on normalization, indexing, and performance...' },
		],
	},
]

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const router = useRouter()

	// Reset search when modal closes
	useEffect(() => {
		if (!open) {
			setSearchQuery('')
		}
	}, [open])

	const filteredChats = recentChats.filter((chat) =>
		chat.title.toLowerCase().includes(searchQuery.toLowerCase())
	)

	const handleSelectChat = (chatId: string) => {
		// Store the selected chat in sessionStorage for the chat page to load
		const selectedChat = recentChats.find((chat) => chat.id === chatId)
		if (selectedChat) {
			sessionStorage.setItem('selectedChat', JSON.stringify(selectedChat))
			// Trigger custom event to reload chat
			window.dispatchEvent(new Event('chatChanged'))
			onOpenChange(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0a0d11]/95 backdrop-blur-2xl border border-[#57FCFF]/30 shadow-2xl sm:max-w-3xl p-0 gap-0 max-h-[600px]">
				<Command className="bg-transparent border-0">
					<div className="px-6 py-5 border-b border-[#57FCFF]/20">
						<CommandInput
							placeholder="Search conversations..."
							value={searchQuery}
							onValueChange={setSearchQuery}
							className="h-12 border-0 bg-transparent text-base placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
						/>
					</div>
					<CommandList className="max-h-[480px] p-3">
						<CommandEmpty className="py-16 text-center text-muted-foreground/60">
							No conversations found
						</CommandEmpty>
						<CommandGroup className="p-0">
							{filteredChats.map((chat) => (
								<CommandItem
									key={chat.id}
									value={chat.title}
									onSelect={() => handleSelectChat(chat.id)}
									className="flex items-center gap-4 py-4 px-4 rounded-lg cursor-pointer hover:bg-[#57FCFF]/10 aria-selected:bg-[#57FCFF]/15 transition-all mb-1"
								>
									<History className="w-5 h-5 text-[#57FCFF]/70 flex-shrink-0" />
									<div className="flex-1 min-w-0">
										<div className="text-base font-medium text-foreground truncate">
											{chat.title}
										</div>
										<div className="text-sm text-muted-foreground/60 mt-1">
											{chat.model} • {chat.timestamp}
										</div>
									</div>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	)
}
