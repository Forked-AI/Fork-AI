'use client'

import { cn } from '@/lib/utils'
import { Check, Copy, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { memo, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

interface MarkdownRendererProps {
	content: string
	className?: string
	variant?: 'default' | 'compact'
}

// Security: Sanitize URLs to prevent XSS attacks
function sanitizeUrl(url: string | undefined): string | undefined {
	if (!url) return undefined

	const trimmedUrl = url.trim().toLowerCase()

	// Block dangerous protocols
	const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']
	if (dangerousProtocols.some((protocol) => trimmedUrl.startsWith(protocol))) {
		return undefined
	}

	// Only allow http, https, and mailto protocols
	if (
		!trimmedUrl.startsWith('http://') &&
		!trimmedUrl.startsWith('https://') &&
		!trimmedUrl.startsWith('mailto:') &&
		!trimmedUrl.startsWith('#') &&
		!trimmedUrl.startsWith('/')
	) {
		return undefined
	}

	return url.trim()
}

function isExternalHttpUrl(url: string): boolean {
	const normalizedUrl = url.trim().toLowerCase()

	return (
		normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')
	)
}

// Code block component with copy functionality
function CodeBlock({
	language,
	children,
	compact = false,
}: {
	language: string | undefined
	children: string
	compact?: boolean
}) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		await navigator.clipboard.writeText(children)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const lineCount = children.split('\n').length

	return (
		<div className={cn('group relative', compact ? 'my-2' : 'my-4')}>
			{/* Language tag - minimal, positioned top-right */}
			{language && (
				<div className="absolute -top-2.5 left-4 z-10">
					<span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 bg-[#0d1117] rounded border border-border/30">
						{language}
					</span>
				</div>
			)}

			{/* Copy button - appears on hover, minimal design */}
			<button
				onClick={handleCopy}
				className="absolute top-3 right-3 z-10 p-1.5 rounded invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/5 hover:bg-white/10 border border-transparent hover:border-border/30"
				title="Copy code"
			>
				{copied ? (
					<Check className="w-3.5 h-3.5 text-green-400" />
				) : (
					<Copy className="w-3.5 h-3.5 text-muted-foreground" />
				)}
			</button>

			{/* Code content */}
			<div className="max-w-full overflow-x-auto rounded-lg border border-border/30 bg-[#0d1117]">
				<SyntaxHighlighter
					language={language || 'text'}
					style={oneDark}
					customStyle={{
						margin: 0,
						padding: compact ? '0.875rem' : '1.25rem',
						paddingTop: language
							? compact
								? '1.125rem'
								: '1.5rem'
							: compact
								? '0.875rem'
								: '1.25rem',
						background: 'transparent',
						fontSize: compact ? '0.75rem' : '0.8125rem',
						lineHeight: 1.7,
						minWidth: '100%',
					}}
					showLineNumbers={lineCount > 5}
					lineNumberStyle={{
						minWidth: '2.5em',
						paddingRight: '1em',
						color: 'rgba(255,255,255,0.15)',
						fontSize: compact ? '0.6875rem' : '0.75rem',
						userSelect: 'none',
					}}
					codeTagProps={{
						style: {
							background: 'transparent',
						},
					}}
				>
					{children}
				</SyntaxHighlighter>
			</div>
		</div>
	)
}

// Inline code component
function InlineCode({ children }: { children: React.ReactNode }) {
	return (
		<code className="break-all whitespace-pre-wrap rounded border border-border/30 bg-[#1a1d24] px-1.5 py-0.5 font-mono text-sm text-[#57FCFF]">
			{children}
		</code>
	)
}

// YouTube video component
function YouTubeEmbed({
	url,
	compact = false,
}: {
	url: string
	compact?: boolean
}) {
	// Security: Extract video ID only from official YouTube domains
	const getVideoId = (url: string): string | null => {
		try {
			const urlObj = new URL(url)

			// Only allow official YouTube domains
			const allowedHosts = [
				'youtube.com',
				'www.youtube.com',
				'youtu.be',
				'www.youtu.be',
			]
			if (!allowedHosts.includes(urlObj.hostname)) {
				return null
			}

			const patterns = [
				/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
				/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
				/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
				/(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
			]

			for (const pattern of patterns) {
				const match = url.match(pattern)
				if (match) return match[1]
			}
		} catch {
			return null
		}
		return null
	}

	const videoId = getVideoId(url)

	if (!videoId) {
		return null // Not a valid YouTube URL
	}

	return (
		<div
			className={cn(
				'relative overflow-hidden rounded-lg border border-border/30 bg-[#0d1117]',
				compact ? 'my-2' : 'my-4'
			)}
		>
			<div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
				<iframe
					className="absolute top-0 left-0 w-full h-full"
					src={`https://www.youtube.com/embed/${videoId}`}
					title="YouTube video"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
				/>
			</div>
		</div>
	)
}

// Image component with error handling
function MarkdownImage({
	src,
	alt,
	compact = false,
}: {
	src?: string
	alt?: string
	compact?: boolean
}) {
	const [error, setError] = useState(false)
	const [loading, setLoading] = useState(true)

	// Security: Validate image URL
	const sanitizedSrc = sanitizeUrl(src)
	if (!sanitizedSrc) {
		return null
	}

	if (error) {
		return (
			<div className="my-4 flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-[#1a1d24]/50 text-muted-foreground">
				<ImageIcon className="w-5 h-5 shrink-0" />
				<div className="text-sm">
					<div className="font-medium">Image unavailable</div>
					{alt && <div className="text-xs mt-0.5 opacity-70">{alt}</div>}
				</div>
			</div>
		)
	}

	return (
		<div
			className={cn(
				'relative max-w-full overflow-hidden rounded-lg border border-border/30 bg-[#0d1117]',
				compact ? 'my-2' : 'my-4'
			)}
		>
			{loading && (
				<div className="absolute inset-0 flex items-center justify-center bg-[#1a1d24]/50">
					<div className="w-8 h-8 border-2 border-[#57FCFF]/30 border-t-[#57FCFF] rounded-full animate-spin" />
				</div>
			)}
			<Image
				src={sanitizedSrc}
				alt={alt || 'Image'}
				width={800}
				height={600}
				className="w-full h-auto max-h-[600px] object-contain"
				onLoad={() => setLoading(false)}
				onError={() => {
					setError(true)
					setLoading(false)
				}}
				loading="lazy"
				unoptimized // Allow external URLs without Next.js optimization
			/>
			{alt && !loading && (
				<div className="px-3 py-2 text-xs text-muted-foreground bg-[#0d1117]/80 border-t border-border/30">
					{alt}
				</div>
			)}
		</div>
	)
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
	content,
	className,
	variant = 'default',
}: MarkdownRendererProps) {
	const compact = variant === 'compact'
	// Comprehensive content preprocessing for proper rendering
	const processedContent = useMemo(
		() =>
			content
				// Escape currency $ signs ($ followed by numbers) to prevent LaTeX parsing
				// e.g., "$100" → "\$100", but leave "$x + y$" as math
				.replace(/\$(\d)/g, '\\$$1')
				// Convert HTML line breaks to newlines
				.replace(/<br\s*\/?>/gi, '\n')
				// Fix common HTML entities
				.replace(/&nbsp;/gi, ' ')
				.replace(/&amp;/gi, '&')
				.replace(/&lt;/gi, '<')
				.replace(/&gt;/gi, '>')
				// Normalize line endings
				.replace(/\r\n/g, '\n'),
		[content]
	)

	return (
		<div
			className={cn(
				'prose prose-invert min-w-0 max-w-none break-words [overflow-wrap:anywhere] [&_*]:max-w-full',
				compact &&
					'text-sm leading-relaxed [&_blockquote]:my-2 [&_blockquote]:pl-3 [&_hr]:my-4 [&_li]:my-0 [&_ol]:my-2 [&_p]:my-2 [&_table]:text-xs [&_ul]:my-2',
				className
			)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkMath, remarkGfm]}
				rehypePlugins={[rehypeKatex]}
				components={{
					// Code blocks
					code({ className, children, ...props }) {
						const match = /language-(\w+)/.exec(className || '')
						const isInline = !match && !String(children).includes('\n')

						if (isInline) {
							return <InlineCode {...props}>{children}</InlineCode>
						}

						return (
							<CodeBlock language={match?.[1]} compact={compact}>
								{String(children).replace(/\n$/, '')}
							</CodeBlock>
						)
					},

					// Links with YouTube detection and URL sanitization
					a({ href, children }) {
						// Security: Sanitize URL to prevent XSS
						const sanitizedHref = sanitizeUrl(href)
						if (!sanitizedHref) {
							return <span className="text-muted-foreground">{children}</span>
						}

						// Check if this is a YouTube link
						if (
							/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(
								sanitizedHref
							)
						) {
							return <YouTubeEmbed url={sanitizedHref} compact={compact} />
						}

						return (
							<a
								href={sanitizedHref}
								target={isExternalHttpUrl(sanitizedHref) ? '_blank' : undefined}
								rel={
									isExternalHttpUrl(sanitizedHref)
										? 'noopener noreferrer nofollow'
										: undefined
								}
								className="break-all text-[#57FCFF] hover:underline"
							>
								{children}
							</a>
						)
					},

					// Images
					img({ src, alt }) {
						// Only handle string URLs, ignore Blob types
						if (typeof src !== 'string') return null
						return <MarkdownImage src={src} alt={alt} compact={compact} />
					},

					// Paragraphs
					p({ children }) {
						return (
							<p
								className={cn(
									'leading-relaxed',
									compact ? 'mb-2 last:mb-0' : 'mb-4 last:mb-0'
								)}
							>
								{children}
							</p>
						)
					},

					// Headings
					h1({ children }) {
						return (
							<h1
								className={cn(
									'font-bold first:mt-0',
									compact ? 'mb-2 mt-4 text-xl' : 'mb-4 mt-6 text-2xl'
								)}
							>
								{children}
							</h1>
						)
					},
					h2({ children }) {
						return (
							<h2
								className={cn(
									'font-bold first:mt-0',
									compact ? 'mb-2 mt-4 text-lg' : 'mb-3 mt-5 text-xl'
								)}
							>
								{children}
							</h2>
						)
					},
					h3({ children }) {
						return (
							<h3
								className={cn(
									'font-semibold first:mt-0',
									compact ? 'mb-1.5 mt-3 text-base' : 'mb-2 mt-4 text-lg'
								)}
							>
								{children}
							</h3>
						)
					},
					h4({ children }) {
						return (
							<h4
								className={cn(
									'font-semibold first:mt-0',
									compact ? 'mb-1.5 mt-3 text-sm' : 'mb-2 mt-3 text-base'
								)}
							>
								{children}
							</h4>
						)
					},

					// Lists
					ul({ children }) {
						return (
							<ul
								className={cn(
									'list-inside list-disc space-y-1',
									compact ? 'mb-2 pl-1' : 'mb-4'
								)}
							>
								{children}
							</ul>
						)
					},
					ol({ children }) {
						return (
							<ol
								className={cn(
									'list-inside list-decimal space-y-1',
									compact ? 'mb-2 pl-1' : 'mb-4'
								)}
							>
								{children}
							</ol>
						)
					},
					li({ children }) {
						return (
							<li
								className={cn(
									'leading-relaxed',
									compact && '[overflow-wrap:anywhere]'
								)}
							>
								{children}
							</li>
						)
					},

					// Blockquotes
					blockquote({ children }) {
						return (
							<blockquote
								className={cn(
									'italic text-muted-foreground',
									compact
										? 'my-2 border-l-2 border-[#57FCFF]/50 pl-3'
										: 'my-4 border-l-4 border-[#57FCFF]/50 pl-4'
								)}
							>
								{children}
							</blockquote>
						)
					},

					// Tables
					table({ children }) {
						return (
							<div
								className={cn(
									'max-w-full overflow-x-auto',
									compact ? 'my-2' : 'my-4'
								)}
							>
								<table className="min-w-full border-collapse border border-border/50 rounded-lg overflow-hidden">
									{children}
								</table>
							</div>
						)
					},
					thead({ children }) {
						return <thead className="bg-[#1a1d24]">{children}</thead>
					},
					th({ children }) {
						return (
							<th className="px-4 py-2 text-left text-sm font-semibold border-b border-border/50">
								{children}
							</th>
						)
					},
					td({ children }) {
						return (
							<td className="px-4 py-2 text-sm border-b border-border/30">
								{children}
							</td>
						)
					},

					// Horizontal rule
					hr() {
						return (
							<hr
								className={cn('border-border/50', compact ? 'my-4' : 'my-6')}
							/>
						)
					},

					// Strong/Bold
					strong({ children }) {
						return (
							<strong className="font-bold text-foreground">{children}</strong>
						)
					},

					// Emphasis/Italic
					em({ children }) {
						return <em className="italic">{children}</em>
					},

					// Strikethrough
					del({ children }) {
						return (
							<del className="line-through text-muted-foreground">
								{children}
							</del>
						)
					},
				}}
			>
				{processedContent}
			</ReactMarkdown>
		</div>
	)
})
