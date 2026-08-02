'use client'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import { Bookmark, Copy, Flag, Heart, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

interface ProvenanceItem {
	id: string
	type: string
	templateId: string | null
	versionId: string | null
	title: string
	source: string | null
	riskLevel: string | null
	requiredTools: string[]
}

interface MarketplacePostActionsProps {
	postId: string
	initialLiked: boolean
	initialBookmarked: boolean
	provenance: ProvenanceItem[]
}

export function MarketplacePostActions({
	postId,
	initialLiked,
	initialBookmarked,
	provenance,
}: MarketplacePostActionsProps) {
	const { toast } = useToast()
	const [liked, setLiked] = useState(initialLiked)
	const [bookmarked, setBookmarked] = useState(initialBookmarked)
	const [busyAction, setBusyAction] = useState<string | null>(null)

	async function setEngagement(type: 'like' | 'bookmark', enabled: boolean) {
		setBusyAction(type)
		try {
			const response = await fetch(
				`/api/marketplace/posts/${postId}/engagement`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...createIdempotencyHeaders(`marketplace-${type}`),
					},
					body: JSON.stringify({ type, enabled }),
				}
			)
			if (!response.ok) throw new Error('Request failed')
			if (type === 'like') setLiked(enabled)
			else setBookmarked(enabled)
		} catch {
			toast({
				title: 'Action failed',
				description: 'Sign in and try again.',
				variant: 'destructive',
			})
		} finally {
			setBusyAction(null)
		}
	}

	async function copyLink() {
		await navigator.clipboard.writeText(window.location.href)
		toast({ title: 'Link copied' })
	}

	async function reportPost() {
		setBusyAction('report')
		try {
			const response = await fetch(`/api/marketplace/posts/${postId}/report`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('marketplace-report'),
				},
				body: JSON.stringify({
					reason: 'Viewer reported this marketplace post.',
				}),
			})
			if (!response.ok) throw new Error('Request failed')
			toast({ title: 'Report sent' })
		} catch {
			toast({
				title: 'Report failed',
				description: 'Sign in and try again.',
				variant: 'destructive',
			})
		} finally {
			setBusyAction(null)
		}
	}

	async function installSkill(item: ProvenanceItem) {
		if (!item.templateId) return
		setBusyAction(`install-${item.id}`)
		try {
			const response = await fetch('/api/skills/installed', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...createIdempotencyHeaders('marketplace-install-skill'),
				},
				body: JSON.stringify({
					templateId: item.templateId,
					versionId: item.versionId ?? undefined,
				}),
			})
			if (!response.ok) throw new Error('Request failed')
			toast({ title: 'Skill installed', description: item.title })
		} catch {
			toast({
				title: 'Install failed',
				description: 'This skill may no longer be available.',
				variant: 'destructive',
			})
		} finally {
			setBusyAction(null)
		}
	}

	const skillItems = provenance.filter((item) => item.type === 'skill')

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap gap-2">
				<Button
					variant={liked ? 'default' : 'outline'}
					size="sm"
					onClick={() => void setEngagement('like', !liked)}
					disabled={busyAction === 'like'}
				>
					<Heart className="mr-2 h-4 w-4" />
					{liked ? 'Liked' : 'Like'}
				</Button>
				<Button
					variant={bookmarked ? 'default' : 'outline'}
					size="sm"
					onClick={() => void setEngagement('bookmark', !bookmarked)}
					disabled={busyAction === 'bookmark'}
				>
					<Bookmark className="mr-2 h-4 w-4" />
					{bookmarked ? 'Saved' : 'Save'}
				</Button>
				<Button variant="outline" size="sm" onClick={() => void copyLink()}>
					<Copy className="mr-2 h-4 w-4" />
					Copy link
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => void reportPost()}
					disabled={busyAction === 'report'}
				>
					<Flag className="mr-2 h-4 w-4" />
					Report
				</Button>
			</div>

			{skillItems.length > 0 ? (
				<div className="space-y-3">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
						Made with
					</p>
					<div className="grid gap-3 sm:grid-cols-2">
						{skillItems.map((item) => (
							<div
								key={item.id}
								className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-sm font-semibold text-white">
											{item.title}
										</p>
										<p className="mt-1 text-xs text-white/45">
											{item.source === 'first_party'
												? 'ForkAI skill'
												: 'Creator skill'}
											{item.riskLevel ? ` · ${item.riskLevel} risk` : ''}
										</p>
									</div>
									<Button
										size="sm"
										variant="outline"
										onClick={() => void installSkill(item)}
										disabled={busyAction === `install-${item.id}`}
									>
										{busyAction === `install-${item.id}` ? (
											<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
										) : (
											<Plus className="mr-2 h-3.5 w-3.5" />
										)}
										Install
									</Button>
								</div>
								{item.requiredTools.length > 0 ? (
									<p className="mt-3 text-xs text-white/45">
										Tools: {item.requiredTools.join(', ')}
									</p>
								) : (
									<p className="mt-3 text-xs text-white/45">
										No tools requested.
									</p>
								)}
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	)
}
