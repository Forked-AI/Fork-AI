'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Message } from '@/hooks/use-chat'
import { useToast } from '@/hooks/use-toast'
import {
	downloadFile,
	exportAsJSON,
	exportAsMarkdown,
	exportAsText,
	getExportFilename,
} from '@/lib/export-utils'
import { Check, Copy, Download, FileJson, FileText, Link2, Mail, Twitter } from 'lucide-react'
import { useState } from 'react'

interface ShareModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	messages?: Message[]
	conversationTitle?: string
}

export function ShareModal({ open, onOpenChange, messages = [], conversationTitle = 'Untitled Conversation' }: ShareModalProps) {
	const [copied, setCopied] = useState(false)
	const [isExporting, setIsExporting] = useState(false)
	const { toast } = useToast()

	// Temporary placeholder URL - will be replaced with actual share link generation
	const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/chat/shared/placeholder-id`

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl)
			setCopied(true)
			toast({
				title: 'Link copied!',
				description: 'Share link has been copied to clipboard.',
			})
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			toast({
				title: 'Failed to copy',
				description: 'Please try again.',
				variant: 'destructive',
			})
		}
	}

	const handleExport = async (format: 'markdown' | 'json' | 'text') => {
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
				default:
					throw new Error('Unsupported format')
			}

			const filename = getExportFilename(conversationTitle, format)
			downloadFile(content, filename, mimeType)

			toast({
				title: 'Export successful!',
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
	}

	const handleShare = (platform: 'twitter' | 'email') => {
		const text = 'Check out this conversation on Fork AI'
		const encodedUrl = encodeURIComponent(shareUrl)
		const encodedText = encodeURIComponent(text)

		if (platform === 'twitter') {
			window.open(
				`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
				'_blank'
			)
		} else {
			window.location.href = `mailto:?subject=${encodedText}&body=${encodedUrl}`
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0a0d11]/80 backdrop-blur-xl border border-[#57FCFF]/20 sm:max-w-xl">
				<DialogHeader>
					<DialogTitle className="text-foreground flex items-center gap-2">
						<Link2 className="w-5 h-5 text-[#57FCFF]" />
						Share & Export
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Export your conversation or share it with others.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Export Section */}
					<div className="space-y-2">
						<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Export Conversation
						</label>
						<p className="text-xs text-muted-foreground/70 mb-3">
							Download your conversation in various formats for backup or sharing.
						</p>
						<div className="grid grid-cols-3 gap-2">
							<Button
								onClick={() => handleExport('markdown')}
								disabled={isExporting || messages.length === 0}
								variant="outline"
								className="flex-col h-auto py-3 bg-sidebar/50 border-border hover:bg-sidebar hover:border-[#57FCFF]/30 transition-all"
							>
								<FileText className="w-5 h-5 mb-1.5 text-[#57FCFF]" />
								<span className="text-xs">Markdown</span>
							</Button>
							<Button
								onClick={() => handleExport('json')}
								disabled={isExporting || messages.length === 0}
								variant="outline"
								className="flex-col h-auto py-3 bg-sidebar/50 border-border hover:bg-sidebar hover:border-[#57FCFF]/30 transition-all"
							>
								<FileJson className="w-5 h-5 mb-1.5 text-[#57FCFF]" />
								<span className="text-xs">JSON</span>
							</Button>
							<Button
								onClick={() => handleExport('text')}
								disabled={isExporting || messages.length === 0}
								variant="outline"
								className="flex-col h-auto py-3 bg-sidebar/50 border-border hover:bg-sidebar hover:border-[#57FCFF]/30 transition-all"
							>
								<Download className="w-5 h-5 mb-1.5 text-[#57FCFF]" />
								<span className="text-xs">Plain Text</span>
							</Button>
						</div>
					</div>

					{/* Divider */}
					<div className="border-t border-border/50" />

					{/* Share Link */}
					<div className="space-y-2">
						<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
							Share Link
							<span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
								Coming Soon
							</span>
						</label>
						<div className="flex gap-2">
							<Input
								value={shareUrl}
								readOnly
								className="bg-sidebar border-border text-sm font-mono text-foreground/80"
							/>
							<Button
								onClick={handleCopy}
								size="icon"
								variant="outline"
								className="border-[#57FCFF]/30 hover:bg-[#57FCFF]/10 hover:border-[#57FCFF]/50 transition-all"
							>
								{copied ? (
									<Check className="w-4 h-4 text-[#57FCFF]" />
								) : (
									<Copy className="w-4 h-4 text-muted-foreground" />
								)}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground/60">
							Anyone with this link will be able to view this conversation
						</p>
					</div>

					{/* Share Options */}
					<div className="space-y-2">
						<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Share Via
						</label>
						<div className="flex gap-3">
							<Button
								onClick={() => handleShare('twitter')}
								variant="outline"
								className="flex-1 bg-sidebar/50 border-border hover:bg-sidebar hover:border-[#57FCFF]/30 transition-all"
							>
								<Twitter className="w-4 h-4 mr-2" />
								Twitter
							</Button>
							<Button
								onClick={() => handleShare('email')}
								variant="outline"
								className="flex-1 bg-sidebar/50 border-border hover:bg-sidebar hover:border-[#57FCFF]/30 transition-all"
							>
								<Mail className="w-4 h-4 mr-2" />
								Email
							</Button>
						</div>
					</div>

					{/* Privacy Note */}
					<div className="bg-sidebar/30 border border-border/50 rounded-lg p-4">
						<p className="text-xs text-muted-foreground">
							<span className="font-semibold text-foreground">
								Privacy Note:
							</span>{' '}
							Shared conversations are view-only and don't include your personal
							information. You can revoke access at any time.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
