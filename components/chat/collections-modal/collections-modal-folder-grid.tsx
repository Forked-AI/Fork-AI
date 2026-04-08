'use client'

import {
	isMenuItemAction,
	renderMenuActions,
	type MenuAction,
	type MenuItemAction,
} from '@/components/chat/menu-action-renderer'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Folder, FolderOpen, Plus, Search, X } from 'lucide-react'
import type { useCollectionsModalController } from './use-collections-modal-controller'

const MENU_CONTENT_CLASSNAME = 'bg-popover border-border/50 w-48'
const MENU_STYLES = {
	itemClassName: 'text-white hover:bg-white/10',
	destructiveItemClassName: 'text-red-400 hover:bg-red-500/10 hover:text-red-400',
	submenuContentClassName: 'bg-popover border-border/50',
}

type CollectionsModalController = ReturnType<typeof useCollectionsModalController>

export function CollectionsModalFolderGrid({
	controller,
}: {
	controller: CollectionsModalController
}) {
	const renderFolderActionButtons = (actions: MenuAction[]) => {
		const buttonActions = actions.filter(
			(action): action is MenuItemAction =>
				isMenuItemAction(action) && action.key !== 'open'
		)

		return buttonActions.map((action) => {
			const Icon = action.icon

			return (
				<Button
					key={action.key}
					size="sm"
					variant="ghost"
					onClick={() => {
						void action.onSelect()
					}}
					className={
						action.variant === 'destructive'
							? 'h-7 w-7 rounded-full p-0 hover:bg-red-500/20'
							: 'h-7 w-7 rounded-full p-0 hover:bg-white/10'
					}
					aria-label={action.label}
				>
					{Icon ? (
						<Icon
							className={['h-3.5 w-3.5 text-gray-400', action.iconClassName]
								.filter(Boolean)
								.join(' ')}
							style={action.iconStyle}
						/>
					) : null}
				</Button>
			)
		})
	}

	return (
		<>
			<div className="space-y-4">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
					<Input
						placeholder="Search folders..."
						value={controller.folderSearch}
						onChange={(event) => controller.setFolderSearch(event.target.value)}
						className="h-[42px] rounded-[11px] border-white/10 bg-white/5 pl-10 text-white"
					/>
				</div>

				<div className="flex items-center gap-4">
					<Input
						placeholder="New folder name"
						value={controller.newCollectionName}
						onChange={(event) =>
							controller.setNewCollectionName(event.target.value)
						}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								void controller.handleCreate()
							}
						}}
						className="h-[42px] flex-1 rounded-[11px] border-white/10 bg-white/5 px-4 text-white"
					/>
					<div className="flex items-center gap-2">
						{controller.presetColors.map((color) => (
							<button
								key={color}
								onClick={() => controller.setSelectedColor(color)}
								className={`h-6 w-6 rounded-full transition-all ${
									controller.selectedColor === color
										? 'ring-2 ring-white/50 ring-offset-2 ring-offset-[#0a0d11]'
										: 'hover:ring-1 hover:ring-white/30'
								}`}
								style={{ backgroundColor: color }}
							/>
						))}
					</div>
					<Button
						onClick={() => {
							void controller.handleCreate()
						}}
						disabled={
							!controller.newCollectionName.trim() ||
							controller.createCollection.isPending
						}
						className="h-[42px] rounded-[11px] bg-[#00D5BE] px-6 font-bold text-black hover:bg-[#00D5BE]/80"
					>
						<Plus className="mr-2 h-4 w-4" />
						Add
					</Button>
				</div>
			</div>

			<div className="h-px bg-[#5F5F5F]" />

			<div>
				{controller.collectionsError ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<Folder className="mb-4 h-16 w-16 text-red-400/30" />
						<p className="text-sm text-red-400">Failed to load folders</p>
					</div>
				) : controller.isLoadingCollections ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="mb-4 h-16 w-16 animate-pulse rounded-full bg-white/5" />
						<p className="text-sm text-gray-400">Loading folders...</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						<ContextMenu>
							<ContextMenuTrigger asChild>
								<div
									onClick={() =>
										controller.handleFolderClick(controller.uncategorizedFolder)
									}
									className="group relative cursor-pointer rounded-[20px] border border-dashed border-border/50 bg-card/40 p-6 transition-all hover:bg-card/60"
								>
									<div className="flex flex-col items-center space-y-3 text-center">
										<FolderOpen className="h-[74px] w-[74px] text-gray-500" />
										<div>
											<h3 className="mb-1 text-[16px] font-bold text-gray-400">
												Uncategorized
											</h3>
											<p className="text-[12px] text-[#9C9C9C]">
												{controller.uncategorizedCount} chat
												{controller.uncategorizedCount !== 1 ? 's' : ''}
											</p>
										</div>
									</div>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
								{renderMenuActions(
									'context',
									controller.getFolderActions(controller.uncategorizedFolder),
									MENU_STYLES
								)}
							</ContextMenuContent>
						</ContextMenu>

						{controller.filteredFolders.map((collection) => {
							const folderActions = controller.getFolderActions({
								id: collection.id,
								name: collection.name,
								color: collection.color,
								isDefault: collection.isDefault,
							})

							if (controller.editingId === collection.id) {
								const isRenameUnchanged =
									controller.editingName.trim() === collection.name.trim()

								return (
									<div
										key={collection.id}
										className="group relative cursor-pointer rounded-[20px] border border-border/40 bg-card/40 p-6 transition-all hover:bg-card/50"
									>
										<div
											className="flex flex-col items-center space-y-4"
											onClick={(event) => event.stopPropagation()}
										>
											<Folder
												className="mb-2 h-[74px] w-[74px]"
												style={{ color: collection.color }}
											/>
											<Input
												value={controller.editingName}
												onChange={(event) =>
													controller.setEditingName(event.target.value)
												}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														void controller.handleSaveEdit(collection.id)
													}
													if (event.key === 'Escape') {
														controller.handleCancelEdit()
													}
												}}
												className="h-10 w-full border-white/20 bg-white/10 text-center text-white"
												autoFocus
											/>
											<div className="flex gap-2">
												<Button
													onClick={controller.handleCancelEdit}
													size="sm"
													variant="ghost"
													className="h-10 w-10 rounded-[14px] border border-white/10 bg-white/[0.04] p-0 text-gray-300 hover:bg-white/[0.08] hover:text-white"
													aria-label="Cancel folder rename"
												>
													<X className="h-4 w-4" />
												</Button>
												<Button
													onClick={() => {
														void controller.handleSaveEdit(collection.id)
													}}
													size="sm"
													className="h-10 w-10 rounded-[14px] border border-[#57FCFF]/30 bg-[#57FCFF]/12 p-0 text-[#57FCFF] shadow-none hover:bg-[#57FCFF]/20"
													aria-label="Save folder rename"
													disabled={
														!controller.editingName.trim() ||
														isRenameUnchanged ||
														controller.updateCollection.isPending
													}
												>
													<Check className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</div>
								)
							}

							return (
								<ContextMenu key={collection.id}>
									<ContextMenuTrigger asChild>
										<div
											className="group relative cursor-pointer rounded-[20px] border border-border/40 bg-card/40 p-6 transition-all hover:bg-card/50"
											onClick={() =>
												controller.handleFolderClick({
													id: collection.id,
													name: collection.name,
													color: collection.color,
												})
											}
										>
											<div
												className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
												onClick={(event) => event.stopPropagation()}
											>
												{renderFolderActionButtons(folderActions)}
											</div>

											<div className="flex flex-col items-center space-y-3 text-center">
												<Folder
													className="h-[74px] w-[74px]"
													style={{ color: collection.color }}
												/>
												<div>
													<h3 className="mb-1 text-[16px] font-bold text-white">
														{collection.name}
														{collection.isDefault ? (
															<span className="ml-2 text-xs text-gray-500">
																(default)
															</span>
														) : null}
													</h3>
													<p className="text-[12px] text-[#9C9C9C]">
														{collection._count.conversations} chat
														{collection._count.conversations !== 1 ? 's' : ''}
													</p>
												</div>
											</div>
										</div>
									</ContextMenuTrigger>
									<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
										{renderMenuActions('context', folderActions, MENU_STYLES)}
									</ContextMenuContent>
								</ContextMenu>
							)
						})}

						{controller.filteredFolders.length === 0 &&
						controller.folderSearch ? (
							<div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
								<Search className="mb-3 h-10 w-10 text-gray-500" />
								<p className="text-sm text-gray-400">
									No folders matching &quot;{controller.folderSearch}&quot;
								</p>
							</div>
						) : null}
					</div>
				)}
			</div>
		</>
	)
}
