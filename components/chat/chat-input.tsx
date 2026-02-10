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
    Mic,
    Paperclip,
    Pause,
    Sparkles,
    Star,
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

		const handleSend = useCallback(async () => {
			if (!message.trim() || isStreaming || disabled) return

			const content = message.trim()
			setMessage('') // Clear input immediately for better UX

			try {
				await onSendMessage(content, selectedModel.id)
			} catch (error) {
				// Restore message if send fails
				setMessage(content)
				console.error('Failed to send message:', error)
			}
		}, [message, selectedModel.id, isStreaming, disabled, onSendMessage])

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

		const isDisabled = isStreaming || disabled || !message.trim()

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

						{/* Input Field */}
						<textarea
							ref={ref}
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={
								branchContext
									? 'Continue from this point...'
									: 'Start a new branch...'
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
										className="w-72 bg-[#0a0d11]/95 backdrop-blur-2xl border-[#57FCFF]/30 shadow-xl"
									>
										{favoriteModels.map((model) => (
											<DropdownMenuItem
												key={model.id}
												onSelect={() => handleSelectModel(model)}
												className="flex items-start gap-3 px-3 py-2.5 cursor-pointer focus:bg-[#57FCFF]/10 focus:text-foreground"
											>
												<Star className="w-4 h-4 mt-0.5 fill-[#57FCFF] text-[#57FCFF] flex-shrink-0" />
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium text-sm">
															{model.name}
														</span>
														{selectedModel.id === model.id && (
															<div className="w-1.5 h-1.5 rounded-full bg-[#57FCFF]" />
														)}
													</div>
													<span className="text-xs text-muted-foreground line-clamp-1">
														{model.description}
													</span>
												</div>
											</DropdownMenuItem>
										))}

										<DropdownMenuSeparator className="bg-[#57FCFF]/20" />

										<DropdownMenuItem
											onSelect={() => setModelsModalOpen(true)}
											className="flex items-center gap-2 px-3 py-2.5 cursor-pointer focus:bg-[#57FCFF]/10 focus:text-foreground"
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
									>
										<div className="relative w-8 h-8 flex items-center justify-center">
											{/* Spinner ring */}
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
											{/* Pause icon in center */}
											<Pause className="w-4 h-4 text-primary z-10 group-hover:scale-110 transition-transform" />
										</div>
									</button>
								) : (
									<button
										onClick={handleSend}
										className="p-2 rounded-lg bg-primary text-primary-foreground shadow-[0_0_15px_-3px_var(--primary)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
										disabled={isDisabled}
										aria-label="Send message"
									>
										<ArrowUp className="w-4 h-4" />
									</button>
								)}
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
