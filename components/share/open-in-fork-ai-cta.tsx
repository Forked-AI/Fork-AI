'use client'

import { createIdempotencyHeaders } from '@/lib/idempotency-client'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'

interface OpenInForkAICtaProps {
	shareToken: string
	conversationId: string
	shareOwnerId: string
	viewerUserId: string | null
	autoOpen: boolean
}

const ctaClassName =
	'fixed bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-full border border-[#57FCFF]/35 bg-[#57FCFF]/12 px-5 py-3 text-sm font-semibold text-[#57FCFF] shadow-[0_22px_50px_-18px_rgba(87,252,255,0.55)] backdrop-blur-xl transition-all hover:bg-[#57FCFF]/18 hover:text-white sm:bottom-8 sm:right-8'

function getLoginHref(shareToken: string) {
	return `/login?next=${encodeURIComponent(`/share/${shareToken}?openInChat=1`)}`
}

export function OpenInForkAICta({
	shareToken,
	conversationId,
	shareOwnerId,
	viewerUserId,
	autoOpen,
}: OpenInForkAICtaProps) {
	const router = useRouter()
	const [isImporting, setIsImporting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const hasAutoOpenedRef = useRef(false)

	const isOwner = !!viewerUserId && viewerUserId === shareOwnerId

	const handleImport = useCallback(async () => {
		if (!viewerUserId || isOwner || isImporting) return

		setIsImporting(true)
		setError(null)

		try {
			const response = await fetch(`/api/share/${shareToken}/import`, {
				method: 'POST',
				headers: createIdempotencyHeaders('share-import'),
				credentials: 'include',
			})

			const payload = (await response.json().catch(() => null)) as
				| { conversationId?: string; error?: string }
				| null

			if (!response.ok || !payload?.conversationId) {
				throw new Error(payload?.error ?? 'Unable to open this shared conversation.')
			}

			startTransition(() => {
				router.push(`/chat?c=${payload.conversationId}`)
			})
		} catch (importError) {
			setError(
				importError instanceof Error
					? importError.message
					: 'Unable to open this shared conversation.'
			)
			setIsImporting(false)
		}
	}, [isImporting, isOwner, router, shareToken, viewerUserId])

	useEffect(() => {
		if (!autoOpen || !viewerUserId || isOwner || hasAutoOpenedRef.current) {
			return
		}

		hasAutoOpenedRef.current = true
		void handleImport()
	}, [autoOpen, handleImport, isOwner, viewerUserId])

	if (!viewerUserId) {
		return (
			<Link
				href={getLoginHref(shareToken)}
				data-testid="share-open-in-fork-ai-floating-cta"
				aria-label="Open this conversation in ForkAI"
				className={ctaClassName}
			>
				Open in ForkAI
				<span aria-hidden="true">→</span>
			</Link>
		)
	}

	if (isOwner) {
		return (
			<Link
				href={`/chat?c=${conversationId}`}
				data-testid="share-open-in-fork-ai-floating-cta"
				aria-label="Open this conversation in ForkAI"
				className={ctaClassName}
			>
				Open in ForkAI
				<span aria-hidden="true">→</span>
			</Link>
		)
	}

	return (
		<>
			<button
				type="button"
				data-testid="share-open-in-fork-ai-floating-cta"
				aria-label="Open this conversation in ForkAI"
				aria-busy={isImporting}
				onClick={() => void handleImport()}
				disabled={isImporting}
				className={cn(
					ctaClassName,
					'cursor-pointer disabled:cursor-wait disabled:opacity-90',
					error &&
						'border-red-400/35 bg-red-500/12 text-red-100 hover:bg-red-500/16 hover:text-white'
				)}
			>
				{isImporting ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" />
						Opening in ForkAI
					</>
				) : (
					<>
						{error ? 'Unable to open in ForkAI' : 'Open in ForkAI'}
						<span aria-hidden="true">→</span>
					</>
				)}
			</button>

			{error && (
				<p
					data-testid="share-open-in-fork-ai-floating-cta-error"
					className="fixed bottom-20 right-6 z-20 max-w-[260px] rounded-2xl border border-red-400/25 bg-[#1a1214]/90 px-4 py-2 text-xs text-red-100 shadow-[0_18px_40px_-18px_rgba(248,113,113,0.5)] backdrop-blur-xl sm:bottom-24 sm:right-8"
				>
					{error}
				</p>
			)}
		</>
	)
}
