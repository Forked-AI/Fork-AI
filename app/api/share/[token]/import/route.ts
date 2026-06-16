import { auth } from '@/lib/auth'
import { checkRequestRateLimit } from '@/lib/api-rate-limit'
import { RATE_LIMIT_CONSTANTS } from '@/lib/constants'
import {
	getUserIdempotencyActorKey,
	withJsonIdempotency,
} from '@/lib/idempotency'
import { prisma } from '@/lib/prisma'
import type { MessageSnapshot } from '@/lib/share/types'
import { logServerError } from '@/lib/server-safe-log'
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
	request: Request,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const { token } = await params
		const rateLimit = await checkRequestRateLimit(request, {
			bucket: 'share-public-import',
			maxRequests: RATE_LIMIT_CONSTANTS.MAX_PUBLIC_SHARE_IMPORTS_PER_HOUR,
			windowSeconds: 3600,
			identityParts: [token],
			error: 'Too many share import requests. Please try again later.',
			errorCode: 'SHARE_IMPORT_RATE_LIMIT_EXCEEDED',
			scope: 'share/import',
		})
		if (!rateLimit.allowed) {
			return rateLimit.response
		}

		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		return await withJsonIdempotency(
			request,
			{
				scope: 'share:import',
				actorKey: getUserIdempotencyActorKey(session.user.id),
				requestInput: { token },
			},
			async () => {
				const share = await prisma.sharedConversation.findUnique({
					where: { shareToken: token },
				})

				if (!share || !share.isActive) {
					return {
						body: { error: 'Share link not found or has been revoked' },
						status: 404,
					}
				}

				if (share.expiresAt && share.expiresAt < new Date()) {
					return {
						body: { error: 'This share link has expired' },
						status: 410,
					}
				}

				if (session.user.id === share.createdBy) {
					return {
						body: {
							conversationId: share.conversationId,
							imported: false,
						},
					}
				}

				let snapshots: MessageSnapshot[]
				try {
					snapshots = sortSnapshots(
						JSON.parse(share.snapshotData) as MessageSnapshot[]
					)
				} catch (error) {
					logServerError('share/import', 'snapshot_parse_failed', error)
					return {
						body: { error: 'Shared conversation data is unavailable' },
						status: 500,
					}
				}

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

				return {
					body: {
						conversationId,
						imported: true,
					},
					resourceType: 'conversation',
					resourceId: conversationId,
				}
			}
		)
	} catch (error) {
		logServerError('share/import', 'import_failed', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
