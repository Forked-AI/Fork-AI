'use client'

import { CollectionsModal } from '@/components/chat/collections-modal'
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
import { GitBranch, History } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { ShareDialogState } from './use-sidebar-conversation-actions'

interface SidebarDialogsProps {
	branchesOpen: boolean
	closeRenameDialog: () => void
	collectionsOpen: boolean
	compactMode: boolean
	historyOpen: boolean
	isRenameUnchanged: boolean
	isUpdating: boolean
	renameDialog: { id: string; title: string } | null
	renameTitle: string
	searchOpen: boolean
	setBranchesOpen: (open: boolean) => void
	setCollectionsOpen: (open: boolean) => void
	setCompactMode: Dispatch<SetStateAction<boolean>>
	setHistoryOpen: (open: boolean) => void
	setRenameTitle: (title: string) => void
	setSearchOpen: (open: boolean) => void
	setSettingsOpen: (open: boolean) => void
	setShareDialog: Dispatch<SetStateAction<ShareDialogState | null>>
	settingsOpen: boolean
	shareDialog: ShareDialogState | null
	onAutoCompletePairs: (messageIds: string[]) => void
	onCompactModeChange: (compact: boolean) => void
	onSaveRename: () => Promise<void>
}

export function SidebarDialogs({
	branchesOpen,
	closeRenameDialog,
	collectionsOpen,
	compactMode,
	historyOpen,
	isRenameUnchanged,
	isUpdating,
	renameDialog,
	renameTitle,
	searchOpen,
	setBranchesOpen,
	setCollectionsOpen,
	setCompactMode,
	setHistoryOpen,
	setRenameTitle,
	setSearchOpen,
	setSettingsOpen,
	setShareDialog,
	settingsOpen,
	shareDialog,
	onAutoCompletePairs,
	onCompactModeChange,
	onSaveRename,
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
				open={historyOpen}
				onOpenChange={setHistoryOpen}
				title="History"
				description="View your conversation history"
				icon={History}
			/>
			<CollectionsModal
				open={collectionsOpen}
				onOpenChange={setCollectionsOpen}
			/>
			<PlaceholderModal
				open={branchesOpen}
				onOpenChange={setBranchesOpen}
				title="Branches"
				description="View and manage conversation branches"
				icon={GitBranch}
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
