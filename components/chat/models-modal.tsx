'use client'

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ModelCapabilities } from '@/lib/ai/model-catalog'
import { MoreVertical, Search, Star, X } from 'lucide-react'
import Image from 'next/image'
import { useState, type ReactNode } from 'react'

// ── Provider logo helper ──────────────────────────────────────────────────
function ProviderIcon({
	provider,
	size = 'md',
}: {
	provider: string
	size?: 'sm' | 'md' | 'lg'
}) {
	const dim = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
	const imgSize = size === 'lg' ? 48 : size === 'sm' ? 32 : 40

	if (provider.toLowerCase() === 'mistral') {
		return (
			<div
				className={`${dim} rounded-lg bg-[#0d0d0d] border border-orange-500/30 flex items-center justify-center overflow-hidden`}
			>
				<Image
					src="/mistral-logo.png"
					alt="Mistral AI"
					width={imgSize}
					height={imgSize}
					className="object-contain p-1"
				/>
			</div>
		)
	}

	// Fallback: coloured initial
	return (
		<div
			className={`${dim} rounded-lg bg-gradient-to-br from-[#57FCFF]/20 to-[#57FCFF]/5 border border-[#57FCFF]/30 flex items-center justify-center`}
		>
			<span className="text-lg font-bold text-[#57FCFF]">
				{provider.charAt(0)}
			</span>
		</div>
	)
}

export interface Model {
	id: string
	resolvedId: string
	name: string
	description: string
	provider: string
	contextWindow: string
	isFavorite?: boolean
	capabilities: ModelCapabilities
}

interface ModelsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	models: Model[]
	onToggleFavorite: (modelId: string) => void
	onSelectModel: (model: Model) => void
}

type ModelMenuRenderer = 'dropdown' | 'context'

type ModelMenuAction =
	| {
			type: 'item'
			key: string
			label: string
			icon: ReactNode
			onSelect: () => void
			disabled?: boolean
	  }
	| {
			type: 'separator'
			key: string
	  }

const MODEL_MENU_CONTENT_CLASSNAME = 'w-48 bg-popover border-primary/30'
const MODEL_MENU_ITEM_CLASSNAME =
	'flex items-center gap-2 cursor-pointer focus:bg-[#57FCFF]/10'

function getModelCapabilityLabels(capabilities: ModelCapabilities) {
	const labels = ['Text']
	if (capabilities.supportsImages) labels.push('Vision')
	if (capabilities.supportsDocumentAttachments) labels.push('Docs')
	if (capabilities.supportsAudioInput) labels.push('Audio')
	if (capabilities.supportsAudioTranscription) labels.push('Transcribe')
	if (capabilities.supportsImageGeneration) labels.push('Image gen')
	if (capabilities.supportsNativeWebSearch) labels.push('Native search')
	if (capabilities.supportsFunctionCalling) labels.push('Functions')
	return labels
}

function renderModelMenuActions(
	renderer: ModelMenuRenderer,
	actions: ModelMenuAction[]
) {
	return actions.map((action) => {
		if (action.type === 'separator') {
			if (renderer === 'dropdown') {
				return (
					<DropdownMenuSeparator key={action.key} className="bg-primary/20" />
				)
			}

			return <ContextMenuSeparator key={action.key} className="bg-primary/20" />
		}

		if (renderer === 'dropdown') {
			return (
				<DropdownMenuItem
					key={action.key}
					onSelect={action.onSelect}
					disabled={action.disabled}
					className={MODEL_MENU_ITEM_CLASSNAME}
				>
					{action.icon}
					<span>{action.label}</span>
				</DropdownMenuItem>
			)
		}

		return (
			<ContextMenuItem
				key={action.key}
				onSelect={action.onSelect}
				disabled={action.disabled}
				className={MODEL_MENU_ITEM_CLASSNAME}
			>
				{action.icon}
				<span>{action.label}</span>
			</ContextMenuItem>
		)
	})
}

export function ModelsModal({
	open,
	onOpenChange,
	models,
	onToggleFavorite,
	onSelectModel,
}: ModelsModalProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedModelDetails, setSelectedModelDetails] =
		useState<Model | null>(null)

	const MAX_FAVORITES = 4
	const favoriteCount = models.filter((m) => m.isFavorite).length

	const filteredModels = models.filter(
		(model) =>
			model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
			model.provider.toLowerCase().includes(searchQuery.toLowerCase())
	)

	const handleToggleFavoriteWithLimit = (modelId: string) => {
		const model = models.find((m) => m.id === modelId)
		if (model && !model.isFavorite && favoriteCount >= MAX_FAVORITES) {
			// Cannot add more favorites
			return
		}
		onToggleFavorite(modelId)
	}

	const handleSelectModel = (model: Model) => {
		onSelectModel(model)
		onOpenChange(false)
	}

	const getModelMenuActions = (model: Model): ModelMenuAction[] => [
		{
			type: 'item',
			key: 'select',
			label: 'Select model',
			icon: <Star className="w-4 h-4 text-[#57FCFF]" />,
			onSelect: () => handleSelectModel(model),
		},
		{ type: 'separator', key: 'separator-primary' },
		{
			type: 'item',
			key: 'favorite',
			label: model.isFavorite ? 'Unfavorite' : 'Favorite',
			icon: (
				<Star
					className={`w-4 h-4 ${
						model.isFavorite
							? 'fill-[#57FCFF] text-[#57FCFF]'
							: 'text-muted-foreground'
					}`}
				/>
			),
			onSelect: () => handleToggleFavoriteWithLimit(model.id),
			disabled: !model.isFavorite && favoriteCount >= MAX_FAVORITES,
		},
		{
			type: 'item',
			key: 'details',
			label: 'View details',
			icon: <Search className="w-4 h-4 text-muted-foreground" />,
			onSelect: () => setSelectedModelDetails(model),
		},
	]

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-[95vw] sm:max-w-[85vw] md:max-w-[80vw] lg:max-w-[1200px] w-full h-[85vh] p-0 bg-popover border-primary/30 overflow-hidden">
					<DialogHeader className="px-6 pt-6 pb-4 border-b border-[#57FCFF]/20">
						<div className="flex items-center justify-between">
							<DialogTitle className="text-xl font-semibold">
								All Models
							</DialogTitle>
							<div className="flex items-center mr-3 gap-2 px-3 py-1.5 bg-card/30 border border-border/50 rounded-lg">
								<Star className="w-4 h-4 fill-[#57FCFF] text-[#57FCFF]" />
								<span className="text-sm font-medium text-foreground">
									{favoriteCount}/{MAX_FAVORITES}
								</span>
							</div>
						</div>
						<DialogDescription className="sr-only">
							Browse available models, favorite the ones you use most, and
							select the current model.
						</DialogDescription>
						{/* Search Bar */}
						<div className="relative mt-4">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search models by name, provider, or description..."
								className="w-full h-10 pl-10 pr-10 bg-card/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#57FCFF]/50 focus:ring-1 focus:ring-[#57FCFF]/20 transition-all"
							/>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/10 rounded transition-colors"
								>
									<X className="w-3 h-3 text-muted-foreground" />
								</button>
							)}
						</div>
					</DialogHeader>

					{/* Models Grid */}
					<div className="flex-1 overflow-y-auto px-6 py-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredModels.map((model) => {
								const modelMenuActions = getModelMenuActions(model)
								const capabilityLabels = getModelCapabilityLabels(
									model.capabilities
								)

								return (
									<ContextMenu key={model.id}>
										<ContextMenuTrigger asChild>
											<div
												className="relative group p-5 bg-card/30 border border-border/50 rounded-xl hover:border-[#57FCFF]/50 hover:bg-card/50 transition-all cursor-pointer"
												onClick={() => handleSelectModel(model)}
											>
												{/* 3-dot menu */}
												<div className="absolute top-3 right-3">
													<DropdownMenu>
														<DropdownMenuTrigger
															asChild
															onClick={(e) => e.stopPropagation()}
														>
															<button
																className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
																aria-label={`More actions for ${model.name}`}
																type="button"
															>
																<MoreVertical className="w-4 h-4" />
															</button>
														</DropdownMenuTrigger>
														<DropdownMenuContent
															align="end"
															className={MODEL_MENU_CONTENT_CLASSNAME}
															onClick={(e) => e.stopPropagation()}
														>
															{renderModelMenuActions(
																'dropdown',
																modelMenuActions
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												</div>

												{/* Model Logo */}
												<div className="mb-3">
													<ProviderIcon provider={model.provider} size="md" />
												</div>

												{/* Model Info */}
												<div className="space-y-1 pr-8">
													<div className="flex items-center gap-2">
														<h3 className="font-semibold text-foreground">
															{model.name}
														</h3>
														{model.isFavorite && (
															<Star className="w-3.5 h-3.5 fill-[#57FCFF] text-[#57FCFF]" />
														)}
													</div>
													<p className="text-xs text-muted-foreground line-clamp-2">
														{model.description}
													</p>
													<div className="flex flex-wrap gap-1 pt-1">
														{capabilityLabels.map((label) => (
															<span
																key={label}
																className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
															>
																{label}
															</span>
														))}
													</div>
													<div className="flex items-center gap-3 mt-2">
														<span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-mono">
															{model.provider}
														</span>
														<span className="text-[10px] text-muted-foreground/40">
															•
														</span>
														<span className="text-[10px] text-muted-foreground/60">
															{model.contextWindow}
														</span>
													</div>
												</div>
											</div>
										</ContextMenuTrigger>
										<ContextMenuContent
											className={MODEL_MENU_CONTENT_CLASSNAME}
										>
											{renderModelMenuActions('context', modelMenuActions)}
										</ContextMenuContent>
									</ContextMenu>
								)
							})}
						</div>

						{filteredModels.length === 0 && (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<Search className="w-12 h-12 text-muted-foreground/30 mb-3" />
								<p className="text-sm text-muted-foreground">No models found</p>
								<p className="text-xs text-muted-foreground/50 mt-1">
									Try adjusting your search
								</p>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			{/* Model Details Dialog */}
			{selectedModelDetails && (
				<Dialog
					open={!!selectedModelDetails}
					onOpenChange={() => setSelectedModelDetails(null)}
				>
					<DialogContent className="max-w-2xl bg-popover border-primary/30">
						<DialogHeader>
							<DialogTitle className="text-2xl font-semibold flex items-center gap-3">
								<ProviderIcon provider={selectedModelDetails.provider} size="lg" />
								<div>
									<div className="flex items-center gap-2">
										<span>{selectedModelDetails.name}</span>
										{selectedModelDetails.isFavorite && (
											<Star className="w-4 h-4 fill-[#57FCFF] text-[#57FCFF]" />
										)}
									</div>
									<p className="text-sm text-muted-foreground font-normal mt-1">
										{selectedModelDetails.provider}
									</p>
								</div>
							</DialogTitle>
							<DialogDescription className="sr-only">
								View the selected model details and choose whether to favorite
								or select it.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-6 mt-4">
							<div>
								<h3 className="text-sm font-semibold text-foreground mb-2">
									Description
								</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{selectedModelDetails.description}
								</p>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<h3 className="text-sm font-semibold text-foreground mb-2">
										Provider
									</h3>
									<p className="text-sm text-muted-foreground">
										{selectedModelDetails.provider}
									</p>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-foreground mb-2">
										Context Window
									</h3>
									<p className="text-sm text-muted-foreground">
										{selectedModelDetails.contextWindow}
									</p>
								</div>
							</div>

							<div>
								<h3 className="text-sm font-semibold text-foreground mb-2">
									Capabilities
								</h3>
								<div className="flex flex-wrap gap-2">
									{getModelCapabilityLabels(
										selectedModelDetails.capabilities
									).map((label) => (
										<span
											key={label}
											className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground"
										>
											{label}
										</span>
									))}
								</div>
							</div>

							<div className="flex gap-2 pt-4">
								<button
									onClick={() => {
										if (
											!selectedModelDetails.isFavorite &&
											favoriteCount >= MAX_FAVORITES
										) {
											return
										}
										onToggleFavorite(selectedModelDetails.id)
										setSelectedModelDetails({
											...selectedModelDetails,
											isFavorite: !selectedModelDetails.isFavorite,
										})
									}}
									disabled={
										!selectedModelDetails.isFavorite &&
										favoriteCount >= MAX_FAVORITES
									}
									className="flex items-center gap-2 px-4 py-2 bg-card/50 border border-border/50 rounded-lg hover:border-[#57FCFF]/50 hover:bg-card/70 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<Star
										className={`w-4 h-4 ${
											selectedModelDetails.isFavorite
												? 'fill-[#57FCFF] text-[#57FCFF]'
												: 'text-muted-foreground'
										}`}
									/>
									<span>
										{selectedModelDetails.isFavorite
											? 'Unfavorite'
											: 'Add to favorites'}
									</span>
								</button>
								<button
									onClick={() => {
										handleSelectModel(selectedModelDetails)
										setSelectedModelDetails(null)
									}}
									className="flex-1 px-4 py-2 bg-[#57FCFF]/10 border border-[#57FCFF]/30 rounded-lg hover:bg-[#57FCFF]/20 transition-all text-sm font-medium text-[#57FCFF]"
								>
									Select this model
								</button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</>
	)
}
