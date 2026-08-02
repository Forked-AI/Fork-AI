import { OpenInForkAICta } from '@/components/share/open-in-fork-ai-cta'
import { MarkdownRenderer } from '@/components/chat/markdown-renderer'
import { checkRequestRateLimit } from '@/lib/api-rate-limit'
import { auth } from '@/lib/auth'
import { RATE_LIMIT_CONSTANTS } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { logServerError } from '@/lib/server-safe-log'
import type { MessageSnapshot, ShareSummaryData } from '@/lib/share/types'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

// --- Metadata for social preview ---

export async function generateMetadata({
	params,
}: {
	params: Promise<{ token: string }>
}): Promise<Metadata> {
	const { token } = await params

	const share = await prisma.sharedConversation.findUnique({
		where: { shareToken: token },
	})

	if (!share || !share.isActive) {
		return {
			title: 'Shared Conversation — ForkAI',
			robots: { index: false, follow: false },
		}
	}

	let snapshots: MessageSnapshot[]
	let summary: ShareSummaryData | null
	try {
		snapshots = JSON.parse(share.snapshotData) as MessageSnapshot[]
		summary = share.summaryData
			? (JSON.parse(share.summaryData) as ShareSummaryData)
			: null
	} catch (error) {
		logServerError('share/page', 'metadata_parse_failed', error)
		return {
			title: 'Shared Conversation — ForkAI',
			robots: { index: false, follow: false },
		}
	}
	const description =
		summary?.overview ||
		`${snapshots.length} message${snapshots.length !== 1 ? 's' : ''} shared via ForkAI`

	return {
		title: `${share.title} — ForkAI`,
		description,
		robots: { index: false, follow: true },
		openGraph: {
			title: `${share.title} — ForkAI`,
			description,
			type: 'article',
			siteName: 'ForkAI',
		},
		twitter: {
			card: 'summary',
			title: `${share.title} — ForkAI`,
			description,
		},
	}
}

// --- Page Component ---

export default async function SharePage({
	params,
	searchParams,
}: {
	params: Promise<{ token: string }>
	searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
	const { token } = await params
	const resolvedSearchParams = (await searchParams) ?? {}
	const requestHeaders = await headers()
	const rateLimit = await checkRequestRateLimit(
		new Request('http://localhost/share', {
			headers: new Headers(requestHeaders),
		}),
		{
			bucket: 'share-page-read',
			maxRequests: RATE_LIMIT_CONSTANTS.MAX_PUBLIC_SHARE_READS_PER_MINUTE,
			windowSeconds: 60,
			identityParts: [token],
			error: 'Too many share requests. Please try again later.',
			errorCode: 'SHARE_RATE_LIMIT_EXCEEDED',
			scope: 'share/page',
		}
	)
	if (!rateLimit.allowed) {
		return (
			<ShareErrorPage message="Too many share requests. Please try again later." />
		)
	}

	const share = await prisma.sharedConversation.findUnique({
		where: { shareToken: token },
	})

	// Not found or revoked
	if (!share || !share.isActive) {
		notFound()
	}

	// Expired
	if (share.expiresAt && share.expiresAt < new Date()) {
		notFound()
	}

	// Increment access count (server-side, fire-and-forget)
	prisma.sharedConversation
		.update({
			where: { shareToken: token },
			data: { accessCount: { increment: 1 } },
		})
		.catch(() => {})

	let snapshots: MessageSnapshot[]
	let summary: ShareSummaryData | null
	try {
		snapshots = JSON.parse(share.snapshotData) as MessageSnapshot[]
		summary = share.summaryData
			? (JSON.parse(share.summaryData) as ShareSummaryData)
			: null
	} catch (error) {
		logServerError('share/page', 'snapshot_parse_failed', error)
		return (
			<ShareErrorPage message="This shared conversation is temporarily unavailable." />
		)
	}
	const session = await auth.api.getSession({ headers: requestHeaders })
	const viewerUserId = session?.user?.id ?? null
	const openInChatValue = resolvedSearchParams.openInChat
	const normalizedOpenInChatValue = Array.isArray(openInChatValue)
		? openInChatValue[0]
		: openInChatValue
	const openInChat = normalizedOpenInChatValue === '1'

	if (openInChat && viewerUserId === share.createdBy) {
		redirect(`/chat?c=${share.conversationId}`)
	}

	// Build download content if allowed
	const markdownContent = share.allowDownload
		? buildMarkdown(
				share.title,
				summary,
				snapshots,
				share.showTimestamps,
				share.showModel
			)
		: null

	return (
		<div className="min-h-screen overflow-x-hidden bg-[#0a0d11] text-foreground">
			<OpenInForkAICta
				shareToken={share.shareToken}
				conversationId={share.conversationId}
				shareOwnerId={share.createdBy}
				viewerUserId={viewerUserId}
				autoOpen={
					openInChat && !!viewerUserId && viewerUserId !== share.createdBy
				}
			/>

			{/* Header */}
			<header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0d11]/90 backdrop-blur-xl">
				<div className="mx-auto flex w-full min-w-0 max-w-4xl items-center px-6 py-4">
					<Link href="/" className="flex items-center gap-2 group">
						<span className="text-lg font-bold text-[#57FCFF] group-hover:opacity-80 transition-opacity">
							ForkAI
						</span>
					</Link>
				</div>
			</header>

			{/* Main content */}
			<main className="mx-auto w-full min-w-0 max-w-4xl overflow-x-hidden px-6 py-10 pb-32">
				{/* Conversation title & meta */}
				<div className="mb-8 min-w-0">
					<h1 className="text-2xl font-bold text-white mb-2">{share.title}</h1>
					<p className="text-sm text-white/40">
						{snapshots.length} message{snapshots.length !== 1 ? 's' : ''} ·
						shared via ForkAI
						{share.expiresAt && (
							<> · expires {new Date(share.expiresAt).toLocaleDateString()}</>
						)}
					</p>
				</div>

				{summary && (
					<div
						data-testid="share-summary-card"
						className="mb-8 min-w-0 overflow-hidden rounded-2xl border border-[#57FCFF]/20 bg-white/[0.03] p-6 shadow-[0_18px_60px_-32px_rgba(87,252,255,0.45)]"
					>
						<p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#57FCFF]/80">
							Share Summary
						</p>
						<div className="min-w-0 max-w-full text-sm text-white/90">
							<MarkdownRenderer
								content={summary.overview}
								variant="compact"
								className="text-sm text-white/90"
							/>
						</div>
						{summary.keyPoints.length > 0 && (
							<div className="mt-5">
								<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
									Key Points
								</p>
								<ul className="space-y-2 text-sm text-white/75">
									{summary.keyPoints.map((point) => (
										<li key={point} className="flex gap-2">
											<span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#57FCFF]/70" />
											<span>{point}</span>
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				)}

				{/* Messages */}
				<div className="min-w-0 space-y-6">
					{snapshots.map((message) => (
						<SharedMessageBubble
							key={message.id}
							message={message}
							showTimestamps={share.showTimestamps}
							showModel={share.showModel}
						/>
					))}
				</div>

				{/* Download section */}
				{markdownContent && (
					<div className="mt-12 pt-8 border-t border-white/10">
						<DownloadButton content={markdownContent} title={share.title} />
					</div>
				)}

				{/* Footer CTA */}
				<div className="mt-16 pt-8 border-t border-white/10 text-center">
					<p className="text-sm text-white/30 mb-4">
						Powered by ForkAI — The AI chat that branches
					</p>
					<Link
						href="/signup"
						className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#57FCFF] text-black font-semibold text-sm hover:bg-[#57FCFF]/90 transition-all"
					>
						Create your own conversation →
					</Link>
				</div>
			</main>
		</div>
	)
}

// --- Sub-components ---

function ShareErrorPage({ message }: { message: string }) {
	return (
		<div className="min-h-screen bg-[#0a0d11] flex flex-col items-center justify-center px-6">
			<div className="text-center max-w-md">
				<div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
					<svg
						className="w-8 h-8 text-red-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<h1 className="text-xl font-bold text-white mb-3">Link Unavailable</h1>
				<p className="text-white/50 mb-8">{message}</p>
				<Link
					href="/chat"
					className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#57FCFF]/10 border border-[#57FCFF]/30 text-[#57FCFF] font-medium text-sm hover:bg-[#57FCFF]/20 transition-all"
				>
					Go to ForkAI
				</Link>
			</div>
		</div>
	)
}

function SharedMessageBubble({
	message,
	showTimestamps,
	showModel,
}: {
	message: MessageSnapshot
	showTimestamps: boolean
	showModel: boolean
}) {
	const isUser = message.role === 'user'
	const isRedacted = message.content === '[Message redacted by author]'

	return (
		<div
			data-testid={`shared-message-row-${message.id}`}
			className={`flex w-full min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`}
		>
			<div
				data-testid={`shared-message-bubble-${message.id}`}
				className={`w-full min-w-0 overflow-hidden rounded-2xl px-5 py-4 sm:max-w-[85%] ${
					isUser
						? 'bg-[#57FCFF]/10 border border-[#57FCFF]/20 text-white'
						: 'bg-white/5 border border-white/10 text-white/90'
				}`}
			>
				{/* Role label */}
				<div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
					<span
						className={`text-[10px] font-semibold uppercase tracking-wider ${
							isUser ? 'text-[#57FCFF]/70' : 'text-white/40'
						}`}
					>
						{isUser
							? 'You'
							: showModel && message.model
								? message.model
								: 'Assistant'}
					</span>
					{showTimestamps && message.createdAt && (
						<span className="text-[10px] text-white/25">
							{new Date(message.createdAt).toLocaleString()}
						</span>
					)}
				</div>

				{/* Content */}
				{isRedacted ? (
					<p className="text-sm text-white/30 italic">
						[Message redacted by author]
					</p>
				) : (
					<div className="min-w-0 max-w-full text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
						<MarkdownRenderer
							content={message.content}
							variant="compact"
							className="text-sm text-white/90"
						/>
					</div>
				)}
			</div>
		</div>
	)
}

function DownloadButton({
	content,
	title,
}: {
	content: string
	title: string
}) {
	// Client-side download via data URI — wrapped in a server component with inline script
	const filename = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`

	return (
		<div className="flex justify-center">
			<a
				href={`data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`}
				download={filename}
				className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-all"
			>
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
					/>
				</svg>
				Download as Markdown
			</a>
		</div>
	)
}

// --- Markdown export builder ---

function buildMarkdown(
	title: string,
	summary: ShareSummaryData | null,
	snapshots: MessageSnapshot[],
	showTimestamps: boolean,
	showModel: boolean
): string {
	const lines: string[] = [
		`# ${title}`,
		'',
		`*Shared via [ForkAI](https://forkai.tech)*`,
		'',
		'---',
		'',
	]

	if (summary) {
		lines.push('## Summary')
		lines.push('')
		lines.push(summary.overview)
		lines.push('')
		if (summary.keyPoints.length > 0) {
			lines.push('### Key Points')
			lines.push('')
			for (const point of summary.keyPoints) {
				lines.push(`- ${point}`)
			}
			lines.push('')
		}
		lines.push('---')
		lines.push('')
	}

	for (const msg of snapshots) {
		const role =
			msg.role === 'user'
				? '**You**'
				: `**Assistant${showModel && msg.model ? ` (${msg.model})` : ''}**`
		const ts =
			showTimestamps && msg.createdAt
				? ` · *${new Date(msg.createdAt).toLocaleString()}*`
				: ''
		lines.push(`${role}${ts}`)
		lines.push('')
		lines.push(msg.content)
		lines.push('')
		lines.push('---')
		lines.push('')
	}

	return lines.join('\n')
}
