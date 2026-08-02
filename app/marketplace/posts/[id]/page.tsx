import { MarkdownRenderer } from '@/components/chat/markdown-renderer'
import { MarketplacePostActions } from '@/components/marketplace/post-actions'
import { auth } from '@/lib/auth'
import { getPublicMarketplacePost } from '@/lib/marketplace/posts'
import { logServerError } from '@/lib/server-safe-log'
import type { MessageSnapshot, ShareSummaryData } from '@/lib/share/types'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>
}): Promise<Metadata> {
	const { id } = await params
	const post = await getPublicMarketplacePost({ postId: id })
	if (!post) {
		return {
			title: 'Marketplace Post — ForkAI',
			robots: { index: false, follow: false },
		}
	}

	const canonical = `/marketplace/posts/${id}`
	const isIndexable = post.visibility === 'public'

	return {
		title: `${post.title} — ForkAI Marketplace`,
		description: post.summary || 'A shared ForkAI result post.',
		alternates: { canonical },
		robots: { index: isIndexable, follow: isIndexable },
		openGraph: {
			title: `${post.title} — ForkAI Marketplace`,
			description: post.summary || 'A shared ForkAI result post.',
			type: 'article',
			siteName: 'ForkAI',
			url: canonical,
		},
	}
}

export default async function MarketplacePostPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const requestHeaders = await headers()
	const session = await auth.api.getSession({ headers: requestHeaders })
	const post = await getPublicMarketplacePost({
		postId: id,
		viewerUserId: session?.user?.id ?? null,
		incrementView: true,
	})

	if (!post?.share) {
		notFound()
	}

	let snapshots: MessageSnapshot[] = []
	let shareSummary: ShareSummaryData | null = null
	try {
		snapshots = JSON.parse(post.share.snapshotData) as MessageSnapshot[]
		shareSummary = post.share.summaryData
			? (JSON.parse(post.share.summaryData) as ShareSummaryData)
			: null
	} catch (error) {
		logServerError('marketplace/post-page', 'snapshot_parse_failed', error)
		return (
			<MarketplacePostError message="This marketplace post is temporarily unavailable." />
		)
	}

	return (
		<div className="min-h-screen bg-[#0a0d11] text-foreground">
			<header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0d11]/90 backdrop-blur-xl">
				<div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
					<Link href="/" className="text-lg font-bold text-[#57FCFF]">
						ForkAI
					</Link>
					<Link
						href="/chat"
						className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:text-white"
					>
						Open chat
					</Link>
				</div>
			</header>

			<main className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
				<section className="min-w-0 space-y-8">
					<div className="space-y-3">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#57FCFF]/80">
							Result Post
						</p>
						<h1 className="text-3xl font-bold text-white">{post.title}</h1>
						{post.summary ? (
							<p className="max-w-2xl text-sm leading-6 text-white/65">
								{post.summary}
							</p>
						) : null}
						<p className="text-xs text-white/35">
							{snapshots.length} selected message
							{snapshots.length !== 1 ? 's' : ''} · {post.visibility} ·
							published{' '}
							{post.publishedAt
								? new Date(post.publishedAt).toLocaleDateString()
								: 'as draft'}
						</p>
					</div>

					{shareSummary ? (
						<div className="rounded-lg border border-[#57FCFF]/20 bg-white/[0.03] p-5">
							<p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#57FCFF]/80">
								Snapshot summary
							</p>
							<MarkdownRenderer
								content={shareSummary.overview}
								variant="compact"
								className="text-sm text-white/85"
							/>
						</div>
					) : null}

					<div className="space-y-5">
						{snapshots.map((message) => (
							<div
								key={message.id}
								className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
							>
								<div className="mb-3 flex items-center justify-between gap-3">
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
										{message.role === 'user'
											? 'User'
											: message.model || 'Assistant'}
									</p>
									{post.share?.showTimestamps ? (
										<p className="text-xs text-white/30">
											{new Date(message.createdAt).toLocaleString()}
										</p>
									) : null}
								</div>
								<MarkdownRenderer
									content={message.content}
									variant="compact"
									className="text-sm leading-6 text-white/85"
								/>
							</div>
						))}
					</div>
				</section>

				<aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
					<div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
						<MarketplacePostActions
							postId={post.id}
							initialLiked={post.viewer.liked}
							initialBookmarked={post.viewer.bookmarked}
							provenance={post.provenance}
						/>
					</div>
					<div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-xs leading-5 text-white/50">
						This page renders a frozen selected snapshot. It does not live-read
						the creator&apos;s private conversation.
					</div>
				</aside>
			</main>
		</div>
	)
}

function MarketplacePostError({ message }: { message: string }) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[#0a0d11] px-6">
			<div className="max-w-md text-center">
				<h1 className="text-2xl font-bold text-white">Post unavailable</h1>
				<p className="mt-3 text-sm text-white/50">{message}</p>
				<Link
					href="/"
					className="mt-6 inline-flex rounded-lg bg-[#57FCFF] px-4 py-2 text-sm font-semibold text-black"
				>
					Back to ForkAI
				</Link>
			</div>
		</div>
	)
}
