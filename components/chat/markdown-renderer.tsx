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

// Code block component with copy functionality
function CodeBlock({
	language,
	children,
}: {
	language: string | undefined
	children: string
}) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		await navigator.clipboard.writeText(children)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const lineCount = children.split('\n').length

	return (
		<div className="relative my-4 group">
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
			<div className="rounded-lg overflow-hidden border border-border/30 bg-[#0d1117]">
				<SyntaxHighlighter
					language={language || 'text'}
					style={oneDark}
					customStyle={{
						margin: 0,
						padding: '1.25rem',
						paddingTop: language ? '1.5rem' : '1.25rem',
						background: 'transparent',
						fontSize: '0.8125rem',
						lineHeight: 1.7,
					}}
					showLineNumbers={lineCount > 5}
					lineNumberStyle={{
						minWidth: '2.5em',
						paddingRight: '1em',
						color: 'rgba(255,255,255,0.15)',
						fontSize: '0.75rem',
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
		<code className="px-1.5 py-0.5 rounded bg-[#1a1d24] text-[#57FCFF] font-mono text-sm border border-border/30">
			{children}
		</code>
	)
}

// YouTube video component
function YouTubeEmbed({ url }: { url: string }) {
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
		<div className="my-4 relative rounded-lg overflow-hidden border border-border/30 bg-[#0d1117]">
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
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
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
		<div className="my-4 relative rounded-lg overflow-hidden border border-border/30 bg-[#0d1117]">
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
}: MarkdownRendererProps) {
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
		<div className={cn('prose prose-invert max-w-none', className)}>
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
							<CodeBlock language={match?.[1]}>
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
							return <YouTubeEmbed url={sanitizedHref} />
						}

						return (
							<a
								href={sanitizedHref}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[#57FCFF] hover:underline"
							>
								{children}
							</a>
						)
					},

					// Images
					img({ src, alt }) {
						// Only handle string URLs, ignore Blob types
						if (typeof src !== 'string') return null
						return <MarkdownImage src={src} alt={alt} />
					},

					// Paragraphs
					p({ children }) {
						return <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
					},

					// Headings
					h1({ children }) {
						return (
							<h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0">
								{children}
							</h1>
						)
					},
					h2({ children }) {
						return (
							<h2 className="text-xl font-bold mb-3 mt-5 first:mt-0">
								{children}
							</h2>
						)
					},
					h3({ children }) {
						return (
							<h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0">
								{children}
							</h3>
						)
					},
					h4({ children }) {
						return (
							<h4 className="text-base font-semibold mb-2 mt-3 first:mt-0">
								{children}
							</h4>
						)
					},

					// Lists
					ul({ children }) {
						return (
							<ul className="list-disc list-inside mb-4 space-y-1">
								{children}
							</ul>
						)
					},
					ol({ children }) {
						return (
							<ol className="list-decimal list-inside mb-4 space-y-1">
								{children}
							</ol>
						)
					},
					li({ children }) {
						return <li className="leading-relaxed">{children}</li>
					},

					// Blockquotes
					blockquote({ children }) {
						return (
							<blockquote className="border-l-4 border-[#57FCFF]/50 pl-4 my-4 italic text-muted-foreground">
								{children}
							</blockquote>
						)
					},

					// Tables
					table({ children }) {
						return (
							<div className="overflow-x-auto my-4">
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
						return <hr className="my-6 border-border/50" />
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
