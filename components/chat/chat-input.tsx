'use client'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettings } from '@/hooks/use-settings'
import {
	ArrowUp,
	ChevronDown,
	GitBranch,
	ListOrdered,
	Mic,
	Paperclip,
	Pause,
	Play,
	Sparkles,
	Star,
	Trash2,
	X,
} from 'lucide-react'
import { forwardRef, KeyboardEvent, useCallback, useState } from 'react'
import { ModelsModal, type Model } from './models-modal'

const ALL_MODELS: Model[] = [
	{
		id: 'mistral-large',
		name: 'Mistral Large',
		description: 'Top-tier open model for complex tasks',
		provider: 'Mistral',
		contextWindow: '32K context',
		isFavorite: true,
	},
	{
		id: 'mistral-small',
		name: 'Mistral Small',
		description: 'Fast and efficient for everyday tasks',
		provider: 'Mistral',
		contextWindow: '32K context',
		isFavorite: true,
	},
	{
		id: 'codestral',
		name: 'Codestral',
		description: 'Specialized for code generation',
		provider: 'Mistral',
		contextWindow: '32K context',
		isFavorite: true,
	},
	{
		id: 'ministral-8b',
		name: 'Ministral 8B',
		description: 'Lightweight and fast responses',
		provider: 'Mistral',
		contextWindow: '128K context',
		isFavorite: true,
	},
	{
		id: 'ministral-3b',
		name: 'Ministral 3B',
		description: 'Ultra-fast for simple tasks',
		provider: 'Mistral',
		contextWindow: '128K context',
		isFavorite: false,
	},
	{
		id: 'pixtral-large',
		name: 'Pixtral Large',
		description: 'Multimodal with vision capabilities',
		provider: 'Mistral',
		contextWindow: '128K context',
		isFavorite: false,
	},
	{
		id: 'open-mistral-nemo',
		name: 'Mistral Nemo',
		description: 'Open-weight model for general use',
		provider: 'Mistral',
		contextWindow: '128K context',
		isFavorite: false,
	},
]

interface ChatInputProps {
	onSendMessage: (content: string, model: string) => Promise<void>
	onStop?: () => void
	isStreaming?: boolean
	disabled?: boolean
	queuedMessages?: Array<{
		id: string
		content: string
		model: string
		createdAt: Date
	}>
	queueStatus?: 'idle' | 'running' | 'halted'
	onRemoveQueuedMessage?: (id: string) => void
	onClearQueue?: () => void
	onResumeQueue?: () => void
	branchContext?: {
		messageId: string
		preview: string
	} | null
	onClearBranchContext?: () => void
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
	function ChatInput(
		{
			onSendMessage,
			onStop,
			isStreaming = false,
			disabled = false,
			queuedMessages = [],
			queueStatus = 'idle',
			onRemoveQueuedMessage,
			onClearQueue,
			onResumeQueue,
			branchContext,
			onClearBranchContext,
		},
		ref
	) {
		const [message, setMessage] = useState('')
		const [models, setModels] = useState(ALL_MODELS)
		const [selectedModel, setSelectedModel] = useState(
			models.find((m) => m.isFavorite) || models[0]
		)
		const [modelsModalOpen, setModelsModalOpen] = useState(false)
		const { settings } = useSettings()

		const favoriteModels = models.filter((m) => m.isFavorite)

		const handleToggleFavorite = (modelId: string) => {
			setModels((prev) =>
				prev.map((m) =>
					m.id === modelId ? { ...m, isFavorite: !m.isFavorite } : m
				)
			)
		}

		const handleSelectModel = (model: Model) => {
			setSelectedModel(model)
		}

		const getModelLabel = (modelId: string) =>
			models.find((model) => model.id === modelId)?.name ?? modelId

		const handleSend = useCallback(async () => {
			if (!message.trim() || disabled) return

			const content = message.trim()
			setMessage('') // Clear input immediately for better UX

			try {
				await onSendMessage(content, selectedModel.id)
			} catch (error) {
				// Restore message if send fails
				setMessage(content)
				console.error('Failed to send message:', error)
			}
		}, [message, selectedModel.id, disabled, onSendMessage])

		const handleKeyDown = useCallback(
			(e: KeyboardEvent<HTMLTextAreaElement>) => {
				// Shift+Enter always creates new line
				if (e.key === 'Enter' && e.shiftKey) {
					return
				}

				// Check send keybinding setting
				if (settings.sendKeybinding === 'enter') {
					// Enter sends, Ctrl+Enter creates new line
					if (e.key === 'Enter' && !e.ctrlKey) {
						e.preventDefault()
						handleSend()
					}
				} else {
					// Ctrl+Enter sends, Enter creates new line
					if (e.key === 'Enter' && e.ctrlKey) {
						e.preventDefault()
						handleSend()
					}
				}
			},
			[handleSend, settings.sendKeybinding]
		)

		const isSubmitDisabled = disabled || !message.trim()
		const hasQueue = queuedMessages.length > 0

		return (
			<>
				<div className="relative w-full">
					{/* Top Pills - Restored from Figma */}
					<div className="flex gap-3 mb-4 px-1">
						{['Create image', 'Thinking', 'Study'].map((label) => (
							<button
								key={label}
								className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-card border border-border rounded-full hover:text-primary hover:border-primary/50 transition-all"
							>
								{label}
								<ArrowUp className="w-3 h-3 rotate-180 opacity-50" />
							</button>
						))}
					</div>

					<div className="relative flex flex-col w-full bg-[#252525] backdrop-blur-xl border border-border/50 rounded-2xl shadow-sm transition-all hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden">
						{/* Branch Context Banner */}
						{branchContext && (
							<div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
								<GitBranch className="w-4 h-4 text-primary" />
								<div className="flex-1 min-w-0">
									<p className="text-xs text-primary font-medium">
										Branching from message (editing creates alternative version)
									</p>
									<p className="text-xs text-muted-foreground truncate">
										{branchContext.preview}
									</p>
								</div>
								<button
									onClick={onClearBranchContext}
									className="p-1 text-muted-foreground hover:text-primary transition-colors"
									aria-label="Clear branch context"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						)}

						{hasQueue ? (
							<div className="border-b border-border/50 bg-background/30">
								<div className="flex items-center justify-between gap-3 px-4 py-2.5">
									<div className="flex min-w-0 items-center gap-2">
										<ListOrdered className="h-4 w-4 text-primary" />
										<span className="text-xs font-medium text-foreground">
											Queued {queuedMessages.length}
										</span>
										{queueStatus === 'halted' ? (
											<span className="text-[11px] text-destructive">
												Paused after an error
											</span>
										) : (
											<span className="text-[11px] text-muted-foreground">
												{isStreaming ? 'Waiting for current reply' : 'Ready to continue'}
											</span>
										)}
									</div>
									<div className="flex items-center gap-2">
										{queueStatus === 'halted' ? (
											<button
												onClick={onResumeQueue}
												className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
												type="button"
											>
												<Play className="h-3 w-3" />
												Resume
											</button>
										) : null}
										<button
											onClick={onClearQueue}
											className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
											type="button"
										>
											<Trash2 className="h-3 w-3" />
											Clear all
										</button>
									</div>
								</div>
								<div className="max-h-36 overflow-y-auto border-t border-border/40">
									{queuedMessages.map((queuedMessage, index) => (
										<div
											key={queuedMessage.id}
											className="flex items-center gap-3 px-4 py-2 text-xs"
										>
											<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 text-[10px] font-medium text-muted-foreground">
												{index + 1}
											</span>
											<div className="min-w-0 flex-1">
												<p className="truncate text-foreground">
													{queuedMessage.content}
												</p>
												<p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
													{getModelLabel(queuedMessage.model)}
												</p>
											</div>
											<button
												onClick={() =>
													onRemoveQueuedMessage?.(queuedMessage.id)
												}
												className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
												aria-label={`Remove queued message ${index + 1}`}
												type="button"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										</div>
									))}
								</div>
							</div>
						) : null}

						{/* Input Field */}
						<textarea
							ref={ref}
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={
								branchContext
									? 'Continue from this point...'
									: 'Ask anything...'
							}
							className="flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none min-h-[44px] max-h-32"
							rows={1}
						/>

						{/* Bottom Actions */}
						<div className="flex items-center justify-between px-3 pb-3">
							<div className="flex items-center gap-1">
								<button
									className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
									aria-label="Attach file"
								>
									<Paperclip className="w-4 h-4" />
								</button>
								<button
									className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
									aria-label="Voice input"
								>
									<Mic className="w-4 h-4" />
								</button>
							</div>

							<div className="flex items-center gap-2">
								{/* Model Selector */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-card/50 border border-border/50 rounded-lg hover:text-primary hover:border-primary/50 transition-all">
											<span>{selectedModel.name}</span>
											<ChevronDown className="w-3 h-3" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="end"
										className="w-72 bg-[#0a0d11]/95 backdrop-blur-2xl border-primary/30 shadow-xl"
									>
										{favoriteModels.map((model) => (
											<DropdownMenuItem
												key={model.id}
												onSelect={() => handleSelectModel(model)}
												className="flex items-start gap-3 px-3 py-2.5 cursor-pointer focus:bg-primary/10 focus:text-foreground"
											>
												<Star className="w-4 h-4 mt-0.5 fill-primary text-primary flex-shrink-0" />
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium text-sm">
															{model.name}
														</span>
														{selectedModel.id === model.id && (
															<div className="w-1.5 h-1.5 rounded-full bg-primary" />
														)}
													</div>
													<span className="text-xs text-muted-foreground line-clamp-1">
														{model.description}
													</span>
												</div>
											</DropdownMenuItem>
										))}

										<DropdownMenuSeparator className="bg-primary/20" />

										<DropdownMenuItem
											onSelect={() => setModelsModalOpen(true)}
											className="flex items-center gap-2 px-3 py-2.5 cursor-pointer focus:bg-primary/10 focus:text-foreground"
										>
											<Sparkles className="w-4 h-4 text-muted-foreground" />
											<span className="font-medium text-sm">
												More models...
											</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>

								{isStreaming ? (
									<button
										onClick={onStop}
										className="relative p-2 rounded-lg hover:scale-105 transition-all duration-200 group"
										aria-label="Stop generating"
										title="Stop generating"
										type="button"
									>
										<div className="relative w-8 h-8 flex items-center justify-center">
											<svg
												className="absolute inset-0 w-8 h-8 animate-spin group-hover:opacity-100 transition-opacity"
												viewBox="0 0 32 32"
												fill="none"
											>
												<circle
													cx="16"
													cy="16"
													r="12"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeDasharray="60 20"
													className="text-primary opacity-80 group-hover:opacity-100"
												/>
											</svg>
											<Pause className="w-4 h-4 text-primary z-10 group-hover:scale-110 transition-transform" />
										</div>
									</button>
								) : null}
								<button
									onClick={handleSend}
									className="p-2 rounded-lg bg-primary text-primary-foreground shadow-[0_0_15px_-3px_var(--primary)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={isSubmitDisabled}
									aria-label={isStreaming ? 'Queue message' : 'Send message'}
									title={isStreaming ? 'Queue message' : 'Send message'}
									type="button"
								>
									<ArrowUp className="w-4 h-4" />
								</button>
							</div>
						</div>
					</div>

					<div className="text-center mt-3">
						<p className="text-[10px] text-muted-foreground/40 font-mono tracking-widest uppercase">
							Fork AI Model 0.1
						</p>
					</div>
				</div>

				{/* Models Modal */}
				<ModelsModal
					open={modelsModalOpen}
					onOpenChange={setModelsModalOpen}
					models={models}
					onToggleFavorite={handleToggleFavorite}
					onSelectModel={handleSelectModel}
				/>
			</>
		)
	}
)
