'use client'

import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
	Copy,
	ExternalLink,
	Link2,
	Loader2,
	RefreshCw,
	Share2,
	Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface ShareListItem {
	id: string
	shareToken: string
	shareUrl: string
	title: string
	conversationTitle: string
	messageCount: number
	accessCount: number
	expiresAt: string | null
	allowDownload: boolean
	showTimestamps: boolean
	showModel: boolean
	hasSummary: boolean
	createdAt: string
}

interface ShareListResponse {
	shares: ShareListItem[]
}

type LoadState = 'loading' | 'ready' | 'empty' | 'error' | 'unauthorized'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
})

function formatDate(value: string) {
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function getExpiryLabel(createdAt: string, expiresAt: string | null) {
	if (!expiresAt) return 'Never'

	const created = new Date(createdAt).getTime()
	const expires = new Date(expiresAt).getTime()
	const diffDays = Math.max(0, Math.round((expires - created) / (1000 * 60 * 60 * 24)))

	if (diffDays <= 14) return '7 days'
	return '30 days'
}

function isExpired(expiresAt: string | null) {
	return !!expiresAt && new Date(expiresAt).getTime() < Date.now()
}

export function ChatSharesPage() {
	const { toast } = useToast()
	const [shares, setShares] = useState<ShareListItem[]>([])
	const [loadState, setLoadState] = useState<LoadState>('loading')
	const [revokingToken, setRevokingToken] = useState<string | null>(null)
	const [copiedToken, setCopiedToken] = useState<string | null>(null)
	const copiedTimeoutRef = useRef<number | null>(null)

	const loadShares = useCallback(async () => {
		setLoadState('loading')

		try {
			const response = await fetch('/api/chat/share', {
				credentials: 'include',
			})

			if (response.status === 401) {
				setShares([])
				setLoadState('unauthorized')
				return
			}

			const payload = (await response.json().catch(() => null)) as
				| ShareListResponse
				| { error?: string }
				| null

			if (!response.ok) {
				throw new Error(payload && 'error' in payload ? payload.error : 'Failed to load shares.')
			}

			const nextShares =
				payload && 'shares' in payload && Array.isArray(payload.shares)
					? payload.shares
					: []
			setShares(nextShares)
			setLoadState(nextShares.length > 0 ? 'ready' : 'empty')
		} catch (error) {
			console.error('[ChatSharesPage] Failed to load shares:', error)
			setShares([])
			setLoadState('error')
		}
	}, [])

	useEffect(() => {
		void loadShares()

		return () => {
			if (copiedTimeoutRef.current) {
				window.clearTimeout(copiedTimeoutRef.current)
			}
		}
	}, [loadShares])

	const shareCards = useMemo(
		() =>
			shares.map((share) => {
				const expired = isExpired(share.expiresAt)
				return {
					...share,
					expired,
					statusLabel: expired ? 'Expired' : 'Active',
					expiryLabel: getExpiryLabel(share.createdAt, share.expiresAt),
				}
			}),
		[shares]
	)

	const handleCopy = useCallback(
		async (share: ShareListItem) => {
			try {
				await navigator.clipboard.writeText(share.shareUrl)
				setCopiedToken(share.shareToken)
				if (copiedTimeoutRef.current) {
					window.clearTimeout(copiedTimeoutRef.current)
				}
				copiedTimeoutRef.current = window.setTimeout(() => {
					setCopiedToken((current) => (current === share.shareToken ? null : current))
				}, 1800)
				toast({
					title: 'Link copied',
					description: 'The public share URL is ready to paste.',
				})
			} catch {
				toast({
					title: 'Copy failed',
					description: 'Clipboard access is unavailable in this browser.',
					variant: 'destructive',
				})
			}
		},
		[toast]
	)

	const handleRevoke = useCallback(
		async (share: ShareListItem) => {
			const previousShares = shares
			setRevokingToken(share.shareToken)
			setShares((current) => current.filter((item) => item.id !== share.id))
			setLoadState((current) => (previousShares.length === 1 ? 'empty' : current))

			try {
				const response = await fetch(`/api/share/${share.shareToken}`, {
					method: 'DELETE',
					credentials: 'include',
				})
				const payload = (await response.json().catch(() => null)) as
					| { error?: string }
					| null

				if (!response.ok) {
					throw new Error(payload?.error ?? 'Failed to revoke this share.')
				}

				toast({
					title: 'Share revoked',
					description: 'The link is no longer active.',
				})
			} catch (error) {
				setShares(previousShares)
				setLoadState(previousShares.length > 0 ? 'ready' : 'empty')
				toast({
					title: 'Failed to revoke',
					description:
						error instanceof Error ? error.message : 'Failed to revoke this share.',
					variant: 'destructive',
				})
			} finally {
				setRevokingToken(null)
			}
		},
		[shares, toast]
	)

	return (
		<main
			className="relative flex h-full flex-1 flex-col overflow-hidden rounded-l-[29px]"
			style={{ background: 'var(--chat-background, var(--background))' }}
		>
			<div
				className="pointer-events-none absolute left-[14%] top-[-96px] h-[320px] w-[320px] rounded-full bg-primary/20 opacity-[0.08]"
				style={{ filter: 'blur(220px)' }}
			/>

			<header className="relative z-10 border-b border-border/50 px-6 py-5">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
							Share Lifecycle
						</p>
						<h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
							Manage shared links
						</h1>
						<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
							Review every active public share, copy its URL, inspect its source thread,
							and revoke access when it should no longer stay public.
						</p>
					</div>
					<Button asChild variant="outline" className="border-primary/20 hover:border-primary/40">
						<Link href="/chat">
							<Link2 className="h-4 w-4" />
							Back to chat
						</Link>
					</Button>
				</div>
			</header>

			<div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-6 py-6">
				{loadState === 'loading' ? (
					<div className="grid gap-4 xl:grid-cols-2">
						{Array.from({ length: 4 }, (_, index) => (
							<Card key={index} className="border-border/50 bg-card/60">
								<CardHeader className="gap-3">
									<Skeleton className="h-5 w-40" />
									<Skeleton className="h-4 w-60" />
								</CardHeader>
								<CardContent className="space-y-3">
									<Skeleton className="h-16 w-full" />
									<Skeleton className="h-10 w-full" />
								</CardContent>
								<CardFooter className="justify-between gap-2">
									<Skeleton className="h-9 w-28" />
									<Skeleton className="h-9 w-28" />
								</CardFooter>
							</Card>
						))}
					</div>
				) : null}

				{loadState === 'unauthorized' ? (
					<Empty className="border-primary/15 bg-card/30">
						<EmptyHeader>
							<EmptyMedia variant="icon" className="bg-primary/10 text-primary">
								<Share2 className="h-5 w-5" />
							</EmptyMedia>
							<EmptyTitle>Sign in to manage shares</EmptyTitle>
							<EmptyDescription>
								Public share links belong to your account, so you need to sign in before
								you can review or revoke them.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button asChild>
								<Link href="/login">Go to login</Link>
							</Button>
						</EmptyContent>
					</Empty>
				) : null}

				{loadState === 'error' ? (
					<Empty className="border-destructive/25 bg-destructive/5">
						<EmptyHeader>
							<EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
								<RefreshCw className="h-5 w-5" />
							</EmptyMedia>
							<EmptyTitle>Unable to load shares</EmptyTitle>
							<EmptyDescription>
								The share-management page could not fetch your current links.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button onClick={() => void loadShares()}>
								<RefreshCw className="h-4 w-4" />
								Try again
							</Button>
						</EmptyContent>
					</Empty>
				) : null}

				{loadState === 'empty' ? (
					<Empty className="border-primary/15 bg-card/30">
						<EmptyHeader>
							<EmptyMedia variant="icon" className="bg-primary/10 text-primary">
								<Share2 className="h-5 w-5" />
							</EmptyMedia>
							<EmptyTitle>No active shares yet</EmptyTitle>
							<EmptyDescription>
								Create a share from any conversation and it will appear here with copy,
								open, and revoke controls.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button asChild>
								<Link href="/chat">Open a conversation</Link>
							</Button>
						</EmptyContent>
					</Empty>
				) : null}

				{loadState === 'ready' ? (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/40 px-4 py-3">
							<div>
								<p className="text-sm font-medium text-foreground">
									{shareCards.length} active owner link{shareCards.length === 1 ? '' : 's'}
								</p>
								<p className="text-xs text-muted-foreground">
									Expired links stay visible until you revoke them.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void loadShares()}
								className="border-primary/20"
							>
								<RefreshCw className="h-4 w-4" />
								Refresh
							</Button>
						</div>

						<div className="grid gap-4 xl:grid-cols-2">
							{shareCards.map((share) => (
								<Card
									key={share.id}
									data-testid={`share-card-${share.shareToken}`}
									className={cn(
										'border-border/50 bg-card/60',
										share.expired && 'border-yellow-500/30 bg-yellow-500/[0.04]'
									)}
								>
									<CardHeader className="gap-3">
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div className="min-w-0 space-y-1">
												<CardTitle className="truncate text-base">{share.title}</CardTitle>
												<CardDescription className="truncate">
													From {share.conversationTitle}
												</CardDescription>
											</div>
											<Badge
												variant={share.expired ? 'outline' : 'secondary'}
												className={cn(
													'whitespace-nowrap',
													share.expired
														? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
														: 'bg-primary/12 text-primary'
												)}
											>
												{share.statusLabel}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid gap-3 sm:grid-cols-2">
											<ShareMeta label="Messages" value={`${share.messageCount}`} />
											<ShareMeta label="Views" value={`${share.accessCount}`} />
											<ShareMeta label="Created" value={formatDate(share.createdAt)} />
											<ShareMeta label="Expiry" value={share.expiryLabel} />
										</div>
										<div className="rounded-xl border border-border/40 bg-sidebar/30 p-3">
											<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
												Public URL
											</p>
											<p className="mt-2 break-all font-mono text-xs text-foreground/80">
												{share.shareUrl}
											</p>
										</div>
									</CardContent>
									<CardFooter className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex flex-wrap gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => void handleCopy(share)}
											>
												<Copy className="h-4 w-4" />
												{copiedToken === share.shareToken ? 'Copied' : 'Copy link'}
											</Button>
											<Button asChild variant="outline" size="sm">
												<a
													href={share.shareUrl}
													target="_blank"
													rel="noreferrer"
												>
													<ExternalLink className="h-4 w-4" />
													Open public page
												</a>
											</Button>
										</div>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => void handleRevoke(share)}
											disabled={revokingToken === share.shareToken}
											className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
										>
											{revokingToken === share.shareToken ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Trash2 className="h-4 w-4" />
											)}
											Revoke
										</Button>
									</CardFooter>
								</Card>
							))}
						</div>
					</div>
				) : null}
			</div>
		</main>
	)
}

function ShareMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-border/40 bg-sidebar/25 p-3">
			<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-2 text-sm font-medium text-foreground">{value}</p>
		</div>
	)
}
