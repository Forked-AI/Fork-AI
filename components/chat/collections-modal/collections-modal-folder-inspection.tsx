'use client'

import { renderMenuActions } from '@/components/chat/menu-action-renderer'
import { CollectionsModalSelectionActionBar } from '@/components/chat/collections-modal/collections-modal-selection-action-bar'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
	ArrowLeft,
	Calendar,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Folder,
	MessageSquare,
	MoreVertical,
	Search,
	SortAsc,
} from 'lucide-react'
import type { DateFilter, SortOrder, useCollectionsModalController } from './use-collections-modal-controller'

const MENU_CONTENT_CLASSNAME = 'bg-popover border-border/50 w-48'
const MENU_STYLES = {
	itemClassName: 'text-white hover:bg-white/10',
	destructiveItemClassName: 'text-red-400 hover:bg-red-500/10 hover:text-red-400',
	submenuContentClassName: 'bg-popover border-border/50',
}

type CollectionsModalController = ReturnType<typeof useCollectionsModalController>

export function CollectionsModalFolderInspection({
	controller,
}: {
	controller: CollectionsModalController
}) {
	const inspectingFolder = controller.inspectingFolder

	if (!inspectingFolder) return null

	return (
		<>
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={controller.handleBackToFolders}
						className="h-9 px-3 hover:bg-white/10"
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back
					</Button>
					<div className="flex items-center gap-2">
						<Folder
							className="h-6 w-6"
							style={{ color: inspectingFolder.color }}
						/>
						<h2 className="text-xl font-bold text-white">
							{inspectingFolder.name}
						</h2>
					</div>
				</div>

				<Button
					variant={controller.isSelectMode ? 'default' : 'outline'}
					size="sm"
					onClick={controller.toggleSelectMode}
					className={
						controller.isSelectMode
							? 'bg-[#57FCFF] text-black hover:bg-[#57FCFF]/80'
							: 'border-white/20 text-white hover:bg-white/10'
					}
				>
					{controller.isSelectMode ? 'Done' : 'Select'}
				</Button>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<div className="relative min-w-[200px] flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
					<Input
						placeholder="Search chats..."
						value={controller.chatSearch}
						onChange={(event) => controller.setChatSearch(event.target.value)}
						className="h-[38px] rounded-[11px] border-white/10 bg-white/5 pl-10 text-white"
					/>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-[38px] border-white/20 text-white hover:bg-white/10"
						>
							<Calendar className="mr-2 h-4 w-4" />
							{controller.dateFilter === 'all'
								? 'All time'
								: controller.dateFilter === 'today'
									? 'Today'
									: controller.dateFilter === 'week'
										? 'This week'
										: controller.dateFilter === 'month'
											? 'This month'
											: 'Older'}
							<ChevronDown className="ml-2 h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="border-border/50 bg-popover">
						{(['all', 'today', 'week', 'month', 'older'] as DateFilter[]).map(
							(filter) => (
								<DropdownMenuItem
									key={filter}
									onSelect={() => controller.setDateFilter(filter)}
									className={
										controller.dateFilter === filter
											? 'bg-white/10'
											: 'hover:bg-white/5'
									}
								>
									{filter === 'all'
										? 'All time'
										: filter === 'today'
											? 'Today'
											: filter === 'week'
												? 'This week'
												: filter === 'month'
													? 'This month'
													: 'Older'}
								</DropdownMenuItem>
							)
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-[38px] border-white/20 text-white hover:bg-white/10"
						>
							<SortAsc className="mr-2 h-4 w-4" />
							{controller.sortOrder === 'recent'
								? 'Recent'
								: controller.sortOrder === 'oldest'
									? 'Oldest'
									: 'A-Z'}
							<ChevronDown className="ml-2 h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="border-border/50 bg-popover">
						{(['recent', 'oldest', 'alphabetical'] as SortOrder[]).map(
							(order) => (
								<DropdownMenuItem
									key={order}
									onSelect={() => controller.setSortOrder(order)}
									className={
										controller.sortOrder === order
											? 'bg-white/10'
											: 'hover:bg-white/5'
									}
								>
									{order === 'recent'
										? 'Most recent'
										: order === 'oldest'
											? 'Oldest first'
											: 'Alphabetical'}
								</DropdownMenuItem>
							)
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{controller.isSelectMode ? (
				<div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
					<div className="flex items-center gap-3">
						<input
							type="checkbox"
							checked={
								controller.selectedChats.size === controller.filteredChats.length &&
								controller.filteredChats.length > 0
							}
							onChange={controller.handleSelectAll}
							className="h-4 w-4 rounded border-white/30 bg-transparent"
						/>
						<span className="text-sm text-gray-400">
							{controller.selectedChats.size > 0
								? `${controller.selectedChats.size} selected`
								: 'Select all'}
						</span>
					</div>
					<span className="text-xs text-gray-500">
						⌘A select all • ⌘M move • Esc cancel
					</span>
				</div>
			) : null}

			<div className="space-y-2">
				{controller.isLoadingChats ? (
					<div className="flex flex-col items-center justify-center py-12">
						<div className="mb-3 h-10 w-10 animate-pulse rounded-full bg-white/5" />
						<p className="text-sm text-gray-400">Loading chats...</p>
					</div>
				) : controller.filteredChats.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<MessageSquare className="mb-3 h-12 w-12 text-gray-500" />
						<p className="text-sm text-gray-400">
							{controller.chatSearch
								? `No chats matching "${controller.chatSearch}"`
								: 'No chats in this folder'}
						</p>
					</div>
				) : (
					controller.filteredChats.map((chat) => {
						const chatActions = controller.getChatActions(chat)
						const chatRow = (
							<div
								className={`group flex items-center gap-3 rounded-[12px] border p-4 transition-all ${
									controller.selectedChats.has(chat.id)
										? 'border-primary/30 bg-primary/10'
										: 'border-transparent bg-white/[0.03] hover:bg-white/[0.06]'
								}`}
							>
								{controller.isSelectMode ? (
									<input
										type="checkbox"
										checked={controller.selectedChats.has(chat.id)}
										onChange={() => controller.toggleChatSelection(chat.id)}
										className="h-4 w-4 flex-shrink-0 rounded border-white/30 bg-transparent"
									/>
								) : null}

								<MessageSquare className="h-5 w-5 flex-shrink-0 text-gray-500" />

								<div className="min-w-0 flex-1">
									<h4 className="truncate text-sm font-medium text-white">
										{chat.title}
									</h4>
									<div className="flex items-center gap-2 text-xs text-gray-500">
										<span>{chat.messageCount} messages</span>
										<span>•</span>
										<span>{controller.formatRelativeTime(chat.updatedAt)}</span>
									</div>
								</div>

								{!controller.isSelectMode ? (
									<div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 hover:bg-white/10"
													aria-label={`More actions for ${chat.title}`}
												>
													<MoreVertical className="h-4 w-4 text-gray-400" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="end"
												className={MENU_CONTENT_CLASSNAME}
											>
												{renderMenuActions('dropdown', chatActions, MENU_STYLES)}
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								) : null}
							</div>
						)

						if (controller.isSelectMode) {
							return <div key={chat.id}>{chatRow}</div>
						}

						return (
							<ContextMenu key={chat.id}>
								<ContextMenuTrigger asChild>{chatRow}</ContextMenuTrigger>
								<ContextMenuContent className={MENU_CONTENT_CLASSNAME}>
									{renderMenuActions('context', chatActions, MENU_STYLES)}
								</ContextMenuContent>
							</ContextMenu>
						)
					})
				)}
			</div>

			{controller.folderPagination && controller.folderPagination.totalPages > 1 ? (
				<div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-xs text-gray-500">
						Page {controller.folderPagination.page} of{' '}
						{controller.folderPagination.totalPages} • {controller.totalFolderChats}{' '}
						chat{controller.totalFolderChats !== 1 ? 's' : ''}
					</p>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								controller.setFolderPage((current: number) =>
									Math.max(1, current - 1)
								)
							}
							disabled={controller.folderPage === 1}
							className="border-white/20 text-white hover:bg-white/10"
						>
							<ChevronLeft className="mr-2 h-4 w-4" />
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								controller.setFolderPage((current: number) =>
									Math.min(controller.folderPagination!.totalPages, current + 1)
								)
							}
							disabled={!controller.folderPagination.hasMore}
							className="border-white/20 text-white hover:bg-white/10"
						>
							Next
							<ChevronRight className="ml-2 h-4 w-4" />
						</Button>
					</div>
				</div>
			) : null}

			<CollectionsModalSelectionActionBar
				selectedCount={controller.selectedChats.size}
				onMove={() => controller.setShowMoveDialog(true)}
				onDelete={() =>
					controller.handleDeleteChats(Array.from(controller.selectedChats))
				}
			/>
		</>
	)
}
