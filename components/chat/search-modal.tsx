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
import { History, Loader2, MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SearchModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface SearchResult {
	id: string
	title: string
	lastMessage: {
		content: string
		createdAt: string
	} | null
	messageCount: number
	updatedAt: string
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)
	const debounceRef = useRef<NodeJS.Timeout | null>(null)

	// Reset state when modal closes
	useEffect(() => {
		if (!open) {
			setSearchQuery('')
			setResults([])
			setHasSearched(false)
		}
	}, [open])

	// Load recent conversations on open (no search term)
	useEffect(() => {
		if (open && !searchQuery) {
			fetchConversations('')
		}
	}, [open, searchQuery])

	// Fetch conversations with optional search term
	const fetchConversations = useCallback(async (search: string) => {
		setIsLoading(true)
		try {
			const params = new URLSearchParams({
				limit: '10',
				...(search && { search }),
			})
			
			const response = await fetch(`/api/conversations?${params}`)
			
			if (response.ok) {
				const data = await response.json()
				setResults(data.conversations)
			} else {
				setResults([])
			}
		} catch (error) {
			console.error('Search failed:', error)
			setResults([])
		} finally {
			setIsLoading(false)
			setHasSearched(true)
		}
	}, [])

	// Debounced search
	const handleSearchChange = useCallback((value: string) => {
		setSearchQuery(value)
		
		// Clear previous debounce
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
		}

		// Debounce the search
		debounceRef.current = setTimeout(() => {
			fetchConversations(value)
		}, 300)
	}, [fetchConversations])

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [])

	const handleSelectChat = (conversationId: string) => {
		// Navigate to the conversation
		window.history.replaceState({}, '', `/chat?c=${conversationId}`)
		// Trigger custom event to reload chat
		window.dispatchEvent(new CustomEvent('chatChanged', { 
			detail: { conversationId } 
		}))
		onOpenChange(false)
	}

	// Format relative time
	const formatRelativeTime = (dateString: string) => {
		const date = new Date(dateString)
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffMins = Math.floor(diffMs / 60000)
		const diffHours = Math.floor(diffMs / 3600000)
		const diffDays = Math.floor(diffMs / 86400000)

		if (diffMins < 1) return 'Just now'
		if (diffMins < 60) return `${diffMins}m ago`
		if (diffHours < 24) return `${diffHours}h ago`
		if (diffDays < 7) return `${diffDays}d ago`
		return date.toLocaleDateString()
	}

	// Highlight matching text
	const highlightMatch = (text: string, query: string) => {
		if (!query.trim()) return text
		
		const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
		const parts = text.split(regex)
		
		return parts.map((part, i) => 
			regex.test(part) ? (
				<span key={i} className="text-[#57FCFF] font-medium">{part}</span>
			) : part
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0a0d11]/95 backdrop-blur-2xl border border-[#57FCFF]/30 shadow-2xl sm:max-w-3xl p-0 gap-0 max-h-[600px]">
				<Command className="bg-transparent border-0" shouldFilter={false}>
					<div className="px-6 py-5 border-b border-[#57FCFF]/20">
						<CommandInput
							placeholder="Search conversations..."
							value={searchQuery}
							onValueChange={handleSearchChange}
							className="h-12 border-0 bg-transparent text-base placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
						/>
					</div>
					<CommandList className="max-h-[480px] p-3">
						{isLoading ? (
							<div className="py-16 flex flex-col items-center justify-center text-muted-foreground/60">
								<Loader2 className="w-6 h-6 animate-spin mb-2" />
								<span>Searching...</span>
							</div>
						) : (
							<>
								<CommandEmpty className="py-16 text-center text-muted-foreground/60">
									{hasSearched 
										? (searchQuery 
											? `No results for "${searchQuery}"` 
											: 'No conversations yet')
										: 'Start typing to search...'}
								</CommandEmpty>
								<CommandGroup className="p-0">
									{results.map((conversation) => (
										<CommandItem
											key={conversation.id}
											value={conversation.id}
											onSelect={() => handleSelectChat(conversation.id)}
											className="flex items-center gap-4 py-4 px-4 rounded-lg cursor-pointer hover:bg-[#57FCFF]/10 aria-selected:bg-[#57FCFF]/15 transition-all mb-1"
										>
											<History className="w-5 h-5 text-[#57FCFF]/70 flex-shrink-0" />
											<div className="flex-1 min-w-0">
												<div className="text-base font-medium text-foreground truncate">
													{highlightMatch(conversation.title, searchQuery)}
												</div>
												{conversation.lastMessage && (
													<div className="text-sm text-muted-foreground/60 mt-1 truncate">
														{highlightMatch(
															conversation.lastMessage.content.slice(0, 100),
															searchQuery
														)}
													</div>
												)}
												<div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground/50">
													<span className="flex items-center gap-1">
														<MessageSquare className="w-3 h-3" />
														{conversation.messageCount}
													</span>
													<span>•</span>
													<span>{formatRelativeTime(conversation.updatedAt)}</span>
												</div>
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	)
}
