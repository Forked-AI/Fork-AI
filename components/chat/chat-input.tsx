'use client'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowUp, ChevronDown, Mic, Paperclip, Sparkles, Star } from 'lucide-react'
import { useState } from 'react'
import { ModelsModal, type Model } from './models-modal'

const ALL_MODELS: Model[] = [
	{ id: 'gpt-4', name: 'GPT-4', description: 'Most capable, best for complex tasks', provider: 'OpenAI', contextWindow: '128K context', isFavorite: true },
	{ id: 'claude-3.5', name: 'Claude 3.5 Sonnet', description: 'Great for creative writing and analysis', provider: 'Anthropic', contextWindow: '200K context', isFavorite: true },
	{ id: 'gemini', name: 'Gemini Pro', description: 'Fast and efficient for everyday tasks', provider: 'Google', contextWindow: '1M context', isFavorite: true },
	{ id: 'gpt-3.5', name: 'GPT-3.5 Turbo', description: 'Quick responses and cost-effective', provider: 'OpenAI', contextWindow: '16K context', isFavorite: true },
	{ id: 'claude-opus', name: 'Claude 3 Opus', description: 'Highest intelligence for complex reasoning', provider: 'Anthropic', contextWindow: '200K context', isFavorite: false },
	{ id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Faster GPT-4 with updated knowledge', provider: 'OpenAI', contextWindow: '128K context', isFavorite: false },
	{ id: 'gemini-ultra', name: 'Gemini Ultra', description: 'Most capable Gemini model', provider: 'Google', contextWindow: '1M context', isFavorite: false },
	{ id: 'llama-3', name: 'Llama 3 70B', description: 'Open-source powerhouse', provider: 'Meta', contextWindow: '8K context', isFavorite: false },
	{ id: 'mistral-large', name: 'Mistral Large', description: 'Top-tier open model for complex tasks', provider: 'Mistral', contextWindow: '32K context', isFavorite: false },
	{ id: 'cohere', name: 'Command R+', description: 'Enterprise-ready with RAG capabilities', provider: 'Cohere', contextWindow: '128K context', isFavorite: false },
]

export function ChatInput() {
	const [message, setMessage] = useState('')
	const [models, setModels] = useState(ALL_MODELS)
	const [selectedModel, setSelectedModel] = useState(models.find(m => m.isFavorite) || models[0])
	const [modelsModalOpen, setModelsModalOpen] = useState(false)

	const favoriteModels = models.filter(m => m.isFavorite)

	const handleToggleFavorite = (modelId: string) => {
		setModels(prev => prev.map(m => 
			m.id === modelId ? { ...m, isFavorite: !m.isFavorite } : m
		))
	}

	const handleSelectModel = (model: Model) => {
		setSelectedModel(model)
	}

	return (
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

			<div className="relative flex flex-col w-full bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl shadow-sm transition-all hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden">
				{/* Input Field */}
				<textarea
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder="Start a new branch..."
					className="w-full min-h-[60px] max-h-[200px] p-4 bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground/50 resize-none font-sans"
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
												<span className="font-medium text-sm">{model.name}</span>
												{selectedModel.id === model.id && (
													<div className="w-1.5 h-1.5 rounded-full bg-[#57FCFF]" />
												)}
											</div>
											<span className="text-xs text-muted-foreground line-clamp-1">{model.description}</span>
										</div>
									</DropdownMenuItem>
								))}
								
								<DropdownMenuSeparator className="bg-[#57FCFF]/20" />
								
								<DropdownMenuItem
									onSelect={() => setModelsModalOpen(true)}
									className="flex items-center gap-2 px-3 py-2.5 cursor-pointer focus:bg-[#57FCFF]/10 focus:text-foreground"
								>
									<Sparkles className="w-4 h-4 text-muted-foreground" />
									<span className="font-medium text-sm">More models...</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<button
							className="p-2 rounded-lg bg-primary text-primary-foreground shadow-[0_0_15px_-3px_var(--primary)] hover:opacity-90 transition-opacity"
							disabled={!message}
							aria-label="Send message"
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

			{/* Models Modal */}
			<ModelsModal
				open={modelsModalOpen}
				onOpenChange={setModelsModalOpen}
				models={models}
				onToggleFavorite={handleToggleFavorite}
				onSelectModel={handleSelectModel}
			/>
		</div>
	)
}
