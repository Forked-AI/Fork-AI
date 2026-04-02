import type { MessageSnapshot } from '@/app/api/chat/share/route'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

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
		return { title: 'Shared Conversation — Fork AI' }
	}

	const snapshots: MessageSnapshot[] = JSON.parse(share.snapshotData)
	const description = `${snapshots.length} message${snapshots.length !== 1 ? 's' : ''} shared via Fork AI`

	return {
		title: `${share.title} — Fork AI`,
		description,
		openGraph: {
			title: `${share.title} — Fork AI`,
			description,
			type: 'article',
			siteName: 'Fork AI',
		},
		twitter: {
			card: 'summary',
			title: `${share.title} — Fork AI`,
			description,
		},
	}
}

// --- Page Component ---

export default async function SharePage({
	params,
}: {
	params: Promise<{ token: string }>
}) {
	const { token } = await params

	const share = await prisma.sharedConversation.findUnique({
		where: { shareToken: token },
	})

	// Not found or revoked
	if (!share || !share.isActive) {
		return <ShareErrorPage message="This share link doesn't exist or has been revoked." />
	}

	// Expired
	if (share.expiresAt && share.expiresAt < new Date()) {
		return <ShareErrorPage message="This share link has expired." />
	}

	// Increment access count (server-side, fire-and-forget)
	prisma.sharedConversation
		.update({
			where: { shareToken: token },
			data: { accessCount: { increment: 1 } },
		})
		.catch(() => {})

	const snapshots: MessageSnapshot[] = JSON.parse(share.snapshotData)

	// Build download content if allowed
	const markdownContent = share.allowDownload
		? buildMarkdown(share.title, snapshots, share.showTimestamps, share.showModel)
		: null

	return (
		<div className="min-h-screen bg-[#0a0d11] text-foreground">
			{/* Header */}
			<header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0d11]/90 backdrop-blur-xl">
				<div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
					<Link href="/" className="flex items-center gap-2 group">
						<span className="text-lg font-bold text-[#57FCFF] group-hover:opacity-80 transition-opacity">
							Fork AI
						</span>
					</Link>
					<Link
						href="/chat"
						className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#57FCFF]/10 border border-[#57FCFF]/30 text-[#57FCFF] text-sm font-medium hover:bg-[#57FCFF]/20 transition-all"
					>
						Open in Fork AI →
					</Link>
				</div>
			</header>

			{/* Main content */}
			<main className="max-w-3xl mx-auto px-6 py-10">
				{/* Conversation title & meta */}
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-white mb-2">{share.title}</h1>
					<p className="text-sm text-white/40">
						{snapshots.length} message{snapshots.length !== 1 ? 's' : ''} · shared via Fork AI
						{share.expiresAt && (
							<> · expires {new Date(share.expiresAt).toLocaleDateString()}</>
						)}
					</p>
				</div>

				{/* Messages */}
				<div className="space-y-6">
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
						Powered by Fork AI — The AI chat that branches
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
					Go to Fork AI
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
		<div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
			<div
				className={`max-w-[85%] rounded-2xl px-5 py-4 ${
					isUser
						? 'bg-[#57FCFF]/10 border border-[#57FCFF]/20 text-white'
						: 'bg-white/5 border border-white/10 text-white/90'
				}`}
			>
				{/* Role label */}
				<div className="flex items-center gap-2 mb-2">
					<span
						className={`text-[10px] font-semibold uppercase tracking-wider ${
							isUser ? 'text-[#57FCFF]/70' : 'text-white/40'
						}`}
					>
						{isUser ? 'You' : showModel && message.model ? message.model : 'Assistant'}
					</span>
					{showTimestamps && message.createdAt && (
						<span className="text-[10px] text-white/25">
							{new Date(message.createdAt).toLocaleString()}
						</span>
					)}
				</div>

				{/* Content */}
				{isRedacted ? (
					<p className="text-sm text-white/30 italic">[Message redacted by author]</p>
				) : (
					<div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
						{message.content}
					</div>
				)}
			</div>
		</div>
	)
}

function DownloadButton({ content, title }: { content: string; title: string }) {
	// Client-side download via data URI — wrapped in a server component with inline script
	const filename = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`

	return (
		<div className="flex justify-center">
			<a
				href={`data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`}
				download={filename}
				className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-all"
			>
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
	snapshots: MessageSnapshot[],
	showTimestamps: boolean,
	showModel: boolean
): string {
	const lines: string[] = [
		`# ${title}`,
		'',
		`*Shared via [Fork AI](https://forkai.tech)*`,
		'',
		'---',
		'',
	]

	for (const msg of snapshots) {
		const role = msg.role === 'user' ? '**You**' : `**Assistant${showModel && msg.model ? ` (${msg.model})` : ''}**`
		const ts = showTimestamps && msg.createdAt ? ` · *${new Date(msg.createdAt).toLocaleString()}*` : ''
		lines.push(`${role}${ts}`)
		lines.push('')
		lines.push(msg.content)
		lines.push('')
		lines.push('---')
		lines.push('')
	}

	return lines.join('\n')
}
