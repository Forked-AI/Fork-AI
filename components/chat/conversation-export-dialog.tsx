'use client'

import { ChatModalShell } from '@/components/chat/chat-modal-shell'
import { Button } from '@/components/ui/button'
import type { Message } from '@/hooks/use-chat'
import { useToast } from '@/hooks/use-toast'
import {
	downloadFile,
	exportAsJSON,
	exportAsMarkdown,
	exportAsText,
	getExportFilename,
} from '@/lib/export-utils'
import { Download, FileJson, FileText } from 'lucide-react'
import { useCallback, useState } from 'react'

interface ConversationExportDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	messages?: Message[]
	conversationTitle?: string
}

type ExportFormat = 'markdown' | 'json' | 'text'

export function ConversationExportDialog({
	open,
	onOpenChange,
	messages = [],
	conversationTitle = 'Untitled Conversation',
}: ConversationExportDialogProps) {
	const [isExporting, setIsExporting] = useState(false)
	const { toast } = useToast()

	const handleExport = useCallback(
		async (format: ExportFormat) => {
			if (messages.length === 0) {
				toast({
					title: 'No messages to export',
					description: 'Start a conversation first before exporting.',
					variant: 'destructive',
				})
				return
			}

			setIsExporting(true)

			try {
				let content: string
				let mimeType: string

				switch (format) {
					case 'markdown':
						content = exportAsMarkdown(messages, {
							title: conversationTitle,
							includeTimestamps: true,
							includeModel: true,
						})
						mimeType = 'text/markdown'
						break
					case 'json':
						content = exportAsJSON(messages, {
							title: conversationTitle,
						})
						mimeType = 'application/json'
						break
					case 'text':
						content = exportAsText(messages, {
							title: conversationTitle,
							includeTimestamps: true,
							includeModel: true,
						})
						mimeType = 'text/plain'
						break
				}

				const filename = getExportFilename(conversationTitle, format)
				downloadFile(content, filename, mimeType)

				toast({
					title: 'Export successful',
					description: `Conversation exported as ${format.toUpperCase()}.`,
				})
			} catch (error) {
				console.error('Export failed:', error)
				toast({
					title: 'Export failed',
					description: 'An error occurred while exporting.',
					variant: 'destructive',
				})
			} finally {
				setIsExporting(false)
			}
		},
		[conversationTitle, messages, toast]
	)

	return (
		<ChatModalShell
			open={open}
			onOpenChange={onOpenChange}
			title="Export Conversation"
			description="Download the current conversation in a format that fits your workflow."
			icon={<Download className="h-5 w-5 text-[#57FCFF]" />}
			contentClassName="sm:max-w-xl"
		>
			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Available Formats
				</p>
				<p className="text-xs text-muted-foreground/70">
					Exports include the currently loaded conversation title and message
					content.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<Button
					onClick={() => void handleExport('markdown')}
					disabled={isExporting || messages.length === 0}
					variant="outline"
					className="h-auto flex-col gap-2 bg-sidebar/50 py-4 transition-all hover:border-[#57FCFF]/30 hover:bg-sidebar"
				>
					<FileText className="h-5 w-5 text-[#57FCFF]" />
					<span className="text-xs">Markdown</span>
				</Button>
				<Button
					onClick={() => void handleExport('json')}
					disabled={isExporting || messages.length === 0}
					variant="outline"
					className="h-auto flex-col gap-2 bg-sidebar/50 py-4 transition-all hover:border-[#57FCFF]/30 hover:bg-sidebar"
				>
					<FileJson className="h-5 w-5 text-[#57FCFF]" />
					<span className="text-xs">JSON</span>
				</Button>
				<Button
					onClick={() => void handleExport('text')}
					disabled={isExporting || messages.length === 0}
					variant="outline"
					className="h-auto flex-col gap-2 bg-sidebar/50 py-4 transition-all hover:border-[#57FCFF]/30 hover:bg-sidebar"
				>
					<Download className="h-5 w-5 text-[#57FCFF]" />
					<span className="text-xs">Plain Text</span>
				</Button>
			</div>

			<p className="text-xs text-muted-foreground">
				{messages.length === 0
					? 'Exports are disabled until the conversation has shareable messages.'
					: 'Export is local only and does not publish a share link.'}
			</p>
		</ChatModalShell>
	)
}
