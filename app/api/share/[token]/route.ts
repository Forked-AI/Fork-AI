import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { MessageSnapshot } from '@/app/api/chat/share/route'

// --- GET /api/share/[token] — public read of a shared conversation ---

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const { token } = await params

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

		const snapshots: MessageSnapshot[] = JSON.parse(share.snapshotData)

		return NextResponse.json({
			shareToken: share.shareToken,
			title: share.title,
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
		console.error('[GET /api/share/token] Error:', error)
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
		console.error('[DELETE /api/share/token] Error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
