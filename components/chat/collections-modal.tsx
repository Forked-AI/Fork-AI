'use client'

import { CollectionsModalFolderGrid } from '@/components/chat/collections-modal/collections-modal-folder-grid'
import { CollectionsModalFolderInspection } from '@/components/chat/collections-modal/collections-modal-folder-inspection'
import { useCollectionsModalController } from '@/components/chat/collections-modal/use-collections-modal-controller'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Expand, Folder, FolderOpen, Shrink } from 'lucide-react'

interface CollectionsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CollectionsModal({
	open,
	onOpenChange,
}: CollectionsModalProps) {
	const controller = useCollectionsModalController({ open, onOpenChange })

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent
					className={`overflow-hidden border border-primary/30 bg-popover transition-all duration-300 ${
						controller.isExpanded
							? 'h-[95vh] max-h-[95vh] w-[98vw] max-w-[98vw]'
							: 'max-h-[90vh] max-w-[95vw] sm:max-w-[85vw] lg:max-w-[1041px]'
					}`}
				>
					<DialogHeader className="flex flex-row items-center justify-between px-6 pb-4 pt-6">
						<div className="flex min-w-0 flex-1 items-start justify-between gap-4">
							<div className="min-w-0">
								<DialogTitle className="text-[32px] font-bold text-white">
									{controller.inspectingFolder
										? controller.inspectingFolder.name
										: 'Folders'}
								</DialogTitle>
								<DialogDescription className="text-sm text-gray-400">
									Manage folders and organize chats across pages.
								</DialogDescription>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									controller.setIsExpanded(!controller.isExpanded)
								}
								className="h-8 w-8 p-0 hover:bg-white/10"
							>
								{controller.isExpanded ? (
									<Shrink className="h-4 w-4 text-gray-400" />
								) : (
									<Expand className="h-4 w-4 text-gray-400" />
								)}
							</Button>
						</div>
					</DialogHeader>

					<div
						className={`space-y-6 overflow-y-auto px-6 pb-6 ${
							controller.isExpanded
								? 'max-h-[calc(95vh-100px)]'
								: 'max-h-[calc(90vh-120px)]'
						}`}
					>
						{controller.inspectingFolder ? (
							<CollectionsModalFolderInspection controller={controller} />
						) : (
							<CollectionsModalFolderGrid controller={controller} />
						)}
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!controller.deleteConfirm}
				onOpenChange={() => controller.setDeleteConfirm(null)}
			>
				<AlertDialogContent className="border border-primary/30 bg-popover">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-white">
							Delete Folder
						</AlertDialogTitle>
						<AlertDialogDescription className="text-gray-400">
							Are you sure you want to delete{' '}
							<span className="font-semibold text-white">
								&quot;{controller.deleteConfirm?.name}&quot;
							</span>
							? All conversations will be moved to Uncategorized.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								void controller.confirmDeleteFolder()
							}}
							className="bg-red-600 text-white hover:bg-red-700"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!controller.deleteChatConfirm}
				onOpenChange={() => controller.setDeleteChatConfirm(null)}
			>
				<AlertDialogContent className="border border-primary/30 bg-popover">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-white">
							Delete Chat{controller.deleteChatConfirm?.count !== 1 ? 's' : ''}
						</AlertDialogTitle>
						<AlertDialogDescription className="text-gray-400">
							Are you sure you want to delete{' '}
							{controller.deleteChatConfirm?.count === 1
								? 'this chat'
								: `${controller.deleteChatConfirm?.count} chats`}
							? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								void controller.confirmDeleteChats()
							}}
							className="bg-red-600 text-white hover:bg-red-700"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={controller.showMoveDialog}
				onOpenChange={controller.setShowMoveDialog}
			>
				<DialogContent className="border border-primary/30 bg-popover sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-white">Move to Folder</DialogTitle>
						<DialogDescription className="text-gray-400">
							Choose where to move the selected chats.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-[300px] space-y-2 overflow-y-auto py-2">
						<button
							onClick={() => {
								void controller.handleMoveChats(null)
							}}
							disabled={controller.inspectingFolder?.id === null}
							className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<FolderOpen className="h-5 w-5 text-gray-500" />
							<span className="text-white">Uncategorized</span>
							{controller.inspectingFolder?.id === null ? (
								<span className="ml-auto text-xs text-gray-500">(current)</span>
							) : null}
						</button>

						{controller.collections?.map((folder) => (
							<button
								key={folder.id}
								onClick={() => {
									void controller.handleMoveChats(folder.id)
								}}
								disabled={folder.id === controller.inspectingFolder?.id}
								className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Folder className="h-5 w-5" style={{ color: folder.color }} />
								<span className="text-white">{folder.name}</span>
								{folder.id === controller.inspectingFolder?.id ? (
									<span className="ml-auto text-xs text-gray-500">
										(current)
									</span>
								) : null}
							</button>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
