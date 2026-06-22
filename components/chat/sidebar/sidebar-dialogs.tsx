'use client'

import { CollectionsModal } from '@/components/chat/collections-modal'
import { ForkPlaygroundModal } from '@/components/chat/fork-playground-modal'
import { PlaceholderModal } from '@/components/chat/placeholder-modal'
import { SearchModal } from '@/components/chat/search-modal'
import { SelectiveShareModal } from '@/components/chat/selective-share-modal'
import { SettingsModal } from '@/components/chat/settings-modal'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { History } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { ShareDialogState } from './use-sidebar-conversation-actions'

export type SidebarLibraryModal = 'history' | 'collections' | 'branches'

interface SidebarDialogsProps {
	closeRenameDialog: () => void
	compactMode: boolean
	isRenameUnchanged: boolean
	isUpdating: boolean
	libraryModal: SidebarLibraryModal | null
	onLibraryModalChange: (modal: SidebarLibraryModal | null) => void
	renameDialog: { id: string; title: string } | null
	renameTitle: string
	searchOpen: boolean
	setCompactMode: Dispatch<SetStateAction<boolean>>
	setRenameTitle: (title: string) => void
	setSearchOpen: (open: boolean) => void
	setSettingsOpen: (open: boolean) => void
	setShareDialog: Dispatch<SetStateAction<ShareDialogState | null>>
	settingsOpen: boolean
	shareDialog: ShareDialogState | null
	onAutoCompletePairs: (messageIds: string[]) => void
	onCompactModeChange: (compact: boolean) => void
	onOpenForkView: (conversationId: string) => void
	onSaveRename: () => Promise<void>
	activeConversationId: string | null
	activeConversationTitle?: string | null
}

export function SidebarDialogs({
	closeRenameDialog,
	compactMode,
	isRenameUnchanged,
	isUpdating,
	libraryModal,
	onLibraryModalChange,
	renameDialog,
	renameTitle,
	searchOpen,
	setCompactMode,
	setRenameTitle,
	setSearchOpen,
	setSettingsOpen,
	setShareDialog,
	settingsOpen,
	shareDialog,
	onAutoCompletePairs,
	onCompactModeChange,
	onOpenForkView,
	onSaveRename,
	activeConversationId,
	activeConversationTitle,
}: SidebarDialogsProps) {
	return (
		<>
			<SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
			<SettingsModal
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				compactMode={compactMode}
				onCompactModeChange={(compact) => {
					setCompactMode(compact)
					onCompactModeChange(compact)
				}}
			/>
			<PlaceholderModal
				open={libraryModal === 'history'}
				onOpenChange={(open) => {
					onLibraryModalChange(open ? 'history' : null)
				}}
				title="History"
				description="View your conversation history"
				icon={History}
			/>
			<CollectionsModal
				open={libraryModal === 'collections'}
				onOpenChange={(open) => {
					onLibraryModalChange(open ? 'collections' : null)
				}}
			/>
			<ForkPlaygroundModal
				open={libraryModal === 'branches'}
				onOpenChange={(open) => {
					onLibraryModalChange(open ? 'branches' : null)
				}}
				conversationId={activeConversationId}
				conversationTitle={activeConversationTitle}
				onOpenForkView={onOpenForkView}
			/>

			<Dialog
				open={renameDialog !== null}
				onOpenChange={(open) => {
					if (!open) closeRenameDialog()
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Rename chat</DialogTitle>
						<DialogDescription>
							Update the title shown in your sidebar.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={renameTitle}
						onChange={(event) => setRenameTitle(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								void onSaveRename()
							}
						}}
						placeholder="Chat title"
						autoFocus
					/>
					<DialogFooter>
						<Button variant="outline" onClick={closeRenameDialog}>
							Cancel
						</Button>
						<Button
							onClick={() => {
								void onSaveRename()
							}}
							disabled={!renameTitle.trim() || isRenameUnchanged || isUpdating}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{shareDialog ? (
				<SelectiveShareModal
					open={!!shareDialog}
					onOpenChange={(open) => {
						if (!open) {
							setShareDialog(null)
						}
					}}
					conversationId={shareDialog.conversationId}
					conversationTitle={shareDialog.conversationTitle}
					selectedMessageIds={shareDialog.selectedMessageIds}
					allMessages={shareDialog.allMessages}
					onAutoCompletePairs={onAutoCompletePairs}
				/>
			) : null}
		</>
	)
}
