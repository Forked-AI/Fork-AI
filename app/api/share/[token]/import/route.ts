import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { MessageSnapshot } from '@/lib/share/types'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

function sortSnapshots(snapshots: MessageSnapshot[]) {
	return [...snapshots].sort((a, b) => {
		if (a.orderIndex !== b.orderIndex) {
			return a.orderIndex - b.orderIndex
		}

		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	})
}

function getSnapshotCreatedAt(value: string) {
	const createdAt = new Date(value)
	return Number.isNaN(createdAt.getTime()) ? undefined : createdAt
}

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

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

		if (share.expiresAt && share.expiresAt < new Date()) {
			return NextResponse.json(
				{ error: 'This share link has expired' },
				{ status: 410 }
			)
		}

		if (session.user.id === share.createdBy) {
			return NextResponse.json({
				conversationId: share.conversationId,
				imported: false,
			})
		}

		const snapshots = sortSnapshots(JSON.parse(share.snapshotData) as MessageSnapshot[])

		const conversationId = await prisma.$transaction(async (tx) => {
			const conversation = await tx.conversation.create({
				data: {
					title: share.title,
					userId: session.user.id,
				},
			})

			let previousMessageId: string | null = null

			for (const snapshot of snapshots) {
				const createdAt = getSnapshotCreatedAt(snapshot.createdAt)
				const createdMessage: { id: string } = await tx.message.create({
					data: {
						conversationId: conversation.id,
						role: snapshot.role,
						content: snapshot.content,
						model: snapshot.model ?? null,
						parentMessageId: previousMessageId,
						...(createdAt ? { createdAt } : {}),
					},
				})

				previousMessageId = createdMessage.id
			}

			return conversation.id
		})

		return NextResponse.json({
			conversationId,
			imported: true,
		})
	} catch (error) {
		console.error('[POST /api/share/token/import] Error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
