import { auth } from '@/lib/auth'
import { checkRequestRateLimit } from '@/lib/api-rate-limit'
import { RATE_LIMIT_CONSTANTS } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { logServerError, logServerInfo } from '@/lib/server-safe-log'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { MessageSnapshot, ShareSummaryData } from '@/lib/share/types'

// --- GET /api/share/[token] — public read of a shared conversation ---

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const { token } = await params
		const rateLimit = await checkRequestRateLimit(request, {
			bucket: 'share-public-read',
			maxRequests: RATE_LIMIT_CONSTANTS.MAX_PUBLIC_SHARE_READS_PER_MINUTE,
			windowSeconds: 60,
			identityParts: [token],
			error: 'Too many share requests. Please try again later.',
			errorCode: 'SHARE_RATE_LIMIT_EXCEEDED',
			scope: 'share/public',
		})
		if (!rateLimit.allowed) {
			return rateLimit.response
		}

		const share = await prisma.sharedConversation.findUnique({
			where: { shareToken: token },
		})

		if (!share || !share.isActive) {
			return NextResponse.json(
				{ error: 'Share link not found or has been revoked' },
				{ status: 404 }
			)
		}

		// Check expiry
		if (share.expiresAt && share.expiresAt < new Date()) {
			return NextResponse.json(
				{ error: 'This share link has expired' },
				{ status: 410 }
			)
		}

		// Increment access count (fire-and-forget — don't block response)
		prisma.sharedConversation
			.update({
				where: { shareToken: token },
				data: { accessCount: { increment: 1 } },
			})
			.catch(() => {}) // ignore errors on counter update

		let snapshots: MessageSnapshot[]
		let summary: ShareSummaryData | null
		try {
			snapshots = JSON.parse(share.snapshotData) as MessageSnapshot[]
			summary = share.summaryData
				? (JSON.parse(share.summaryData) as ShareSummaryData)
				: null
		} catch (error) {
			logServerError('share/public', 'snapshot_parse_failed', error)
			return NextResponse.json(
				{ error: 'Shared conversation data is unavailable' },
				{ status: 500 }
			)
		}

		logServerInfo('share/public', 'accessed', {
			messageCount: snapshots.length,
			hasSummary: !!summary,
		})

		return NextResponse.json({
			shareToken: share.shareToken,
			title: share.title,
			summary,
			messages: snapshots,
			settings: {
				allowDownload: share.allowDownload,
				showTimestamps: share.showTimestamps,
				showModel: share.showModel,
			},
			createdAt: share.createdAt.toISOString(),
			expiresAt: share.expiresAt?.toISOString() ?? null,
		})
	} catch (error) {
		logServerError('share/public', 'get_failed', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// --- DELETE /api/share/[token] — revoke a share link (owner only) ---

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const { token } = await params

		// Auth required
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const userId = session.user.id

		const share = await prisma.sharedConversation.findUnique({
			where: { shareToken: token },
		})

		if (!share) {
			return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
		}

		// Ownership check
		if (share.createdBy !== userId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		// Soft delete
		await prisma.sharedConversation.update({
			where: { shareToken: token },
			data: { isActive: false },
		})

		return NextResponse.json({ success: true, revokedAt: new Date().toISOString() })
	} catch (error) {
		logServerError('share/public', 'delete_failed', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
