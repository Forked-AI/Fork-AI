'use client'

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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Message } from '@/hooks/use-chat'
import { useToast } from '@/hooks/use-toast'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import { cn } from '@/lib/utils'
import { ExternalLink, Loader2, Store } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface MarketplacePostDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	conversationId: string
	message: Message
}

type Visibility = 'draft' | 'unlisted' | 'public'

export function MarketplacePostDialog({
	open,
	onOpenChange,
	conversationId,
	message,
}: MarketplacePostDialogProps) {
	const { toast } = useToast()
	const [title, setTitle] = useState('')
	const [summary, setSummary] = useState('')
	const [visibility, setVisibility] = useState<Visibility>('draft')
	const [isPublishing, setIsPublishing] = useState(false)
	const [postId, setPostId] = useState<string | null>(null)

	const skills = useMemo(
		() => message.activeSkillTrace?.items ?? [],
		[message.activeSkillTrace]
	)

	useEffect(() => {
		if (!open) return
		setTitle(defaultTitle(message.content))
		setSummary('')
		setVisibility('draft')
		setPostId(null)
	}, [message.content, open])

	async function publish() {
		setIsPublishing(true)
		try {
			const response = await fetch('/api/marketplace/posts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('marketplace-post'),
				},
				body: JSON.stringify({
					conversationId,
					messageIds: [message.id],
					title,
					summary,
					visibility,
				}),
			})
			const payload = await response.json().catch(() => null)
			if (!response.ok) {
				throw new Error(payload?.error ?? 'Failed to create marketplace post')
			}
			setPostId(payload.post.id)
			toast({
				title: visibility === 'draft' ? 'Draft saved' : 'Post published',
				description: payload.post.title,
			})
		} catch (error) {
			toast({
				title: 'Marketplace post failed',
				description:
					error instanceof Error ? error.message : 'Failed to create post',
				variant: 'destructive',
			})
		} finally {
			setIsPublishing(false)
		}
	}

	const postUrl = postId ? `/marketplace/posts/${postId}` : null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="grid max-h-[90vh] grid-rows-[auto,minmax(0,1fr),auto] overflow-hidden border border-primary/20 bg-popover sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Store className="h-5 w-5 text-[#57FCFF]" />
						Post to Marketplace
					</DialogTitle>
					<DialogDescription>
						Review the frozen result snapshot and made-with metadata before it
						becomes visible.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 space-y-5 overflow-y-auto pr-1">
					<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
						<div className="space-y-2">
							<Label htmlFor="marketplace-post-title">Title</Label>
							<Input
								id="marketplace-post-title"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								maxLength={120}
							/>
						</div>
						<div className="space-y-2">
							<Label>Visibility</Label>
							<div className="grid grid-cols-3 rounded-lg border border-border/60 p-1">
								{(['draft', 'unlisted', 'public'] as const).map((option) => (
									<button
										key={option}
										type="button"
										onClick={() => setVisibility(option)}
										className={cn(
											'rounded-md px-2 py-2 text-xs capitalize transition-colors',
											visibility === option
												? 'bg-[#57FCFF] text-black'
												: 'text-muted-foreground hover:bg-background/50'
										)}
									>
										{option}
									</button>
								))}
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="marketplace-post-summary">Summary</Label>
						<Textarea
							id="marketplace-post-summary"
							value={summary}
							onChange={(event) => setSummary(event.target.value)}
							maxLength={1000}
							placeholder="Optional context for viewers."
							className="min-h-20"
						/>
					</div>

					<section className="rounded-lg border border-border/50 bg-sidebar/20 p-4">
						<p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							Public snapshot
						</p>
						<div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/50 bg-black/10 p-3 text-sm leading-6 text-white/85">
							{message.content}
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							Only this assistant message is selected for the marketplace post.
						</p>
					</section>

					<section className="rounded-lg border border-border/50 bg-sidebar/20 p-4">
						<p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							Made with
						</p>
						{skills.length > 0 ? (
							<div className="space-y-2">
								{skills.map((skill) => (
									<div
										key={`${skill.templateId}:${skill.versionId}`}
										className="rounded-lg border border-border/50 bg-background/30 p-3"
									>
										<p className="text-sm font-medium">{skill.title}</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{skill.source === 'first_party'
												? 'ForkAI skill'
												: 'Creator skill'}{' '}
											· {skill.riskLevel} risk ·{' '}
											{skill.requiredTools.length
												? `${skill.requiredTools.length} tools`
												: 'no tools'}
										</p>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No active skills were recorded on this response.
							</p>
						)}
					</section>

					{postUrl ? (
						<div className="rounded-lg border border-green-500/25 bg-green-500/10 p-4">
							<p className="text-sm font-medium text-green-200">
								Marketplace post is ready.
							</p>
							<Link
								href={postUrl}
								className="mt-2 inline-flex items-center gap-2 text-sm text-[#57FCFF]"
							>
								View post <ExternalLink className="h-3.5 w-3.5" />
							</Link>
						</div>
					) : null}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button
						onClick={() => void publish()}
						disabled={isPublishing || !title.trim() || !!postId}
					>
						{isPublishing ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						{visibility === 'draft' ? 'Save draft' : 'Publish'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function defaultTitle(content: string) {
	const firstLine = content
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean)

	if (!firstLine) return 'ForkAI result'
	return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine
}
