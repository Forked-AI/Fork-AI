import { auth } from '@/lib/auth'
import { checkRequestRateLimit } from '@/lib/api-rate-limit'
import { prisma } from '@/lib/prisma'
import { buildSharePersistencePayload } from '@/lib/share/service'
import type { ShareMessageSelectionInput, ShareSummaryData } from '@/lib/share/types'
import { logServerError } from '@/lib/server-safe-log'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const MAX_SHARE_MESSAGES = 100
const MAX_SHARE_CHARS = 50000

async function checkShareRateLimit(userId: string): Promise<boolean> {
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
	const recentShareCount = await prisma.sharedConversation.count({
		where: {
			createdBy: userId,
			createdAt: { gte: oneDayAgo },
		},
	})
	return recentShareCount < 10
}

const shareSummarySchema = z
	.object({
		overview: z.string().trim().min(1).max(2000),
		keyPoints: z.array(z.string().trim().min(1).max(280)).max(6),
		model: z.string().trim().min(1).max(120),
		generatedAt: z.string().trim().min(1),
		edited: z.boolean().optional(),
	})
	.nullable()

const shareMessageSelectionSchema = z.object({
	id: z.string().min(1),
	approvedFindingIds: z.array(z.string().min(1)).max(30).default([]),
	redactWholeMessage: z.boolean().default(false),
})

const createShareSchema = z.object({
	conversationId: z.string().min(1),
	messageSelections: z.array(shareMessageSelectionSchema).min(1).max(MAX_SHARE_MESSAGES),
	title: z.string().trim().max(200).optional(),
	expiresIn: z.union([z.literal(7), z.literal(30), z.null()]).optional().default(null),
	allowDownload: z.boolean().optional().default(false),
	showTimestamps: z.boolean().optional().default(true),
	showModel: z.boolean().optional().default(true),
	autoMaskPII: z.boolean().optional().default(true),
	summary: shareSummarySchema.optional().default(null),
})

function sortMessagesBySelection<T extends { id: string }>(
	messages: T[],
	selections: ShareMessageSelectionInput[]
) {
	const messageMap = new Map(messages.map((message) => [message.id, message]))
	return selections
		.map((selection) => messageMap.get(selection.id))
		.filter((message): message is T => !!message)
}

function totalContentLength(messages: Array<{ content: string }>) {
	return messages.reduce((sum, message) => sum + message.content.length, 0)
}

function isUniqueConstraintError(error: unknown) {
	return (
		!!error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === 'P2002'
	)
}

async function createShareWithUniqueToken(data: {
	conversationId: string
	createdBy: string
	selectedMessageIds: string
	snapshotData: string
	summaryData: string | null
	maskingData: string
	title: string
	expiresAt: Date | null
	allowDownload: boolean
	showTimestamps: boolean
	showModel: boolean
}) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const shareToken = generateToken()
		const existingShare = await prisma.sharedConversation.findUnique({
			where: { shareToken },
			select: { id: true },
		})

		if (existingShare) {
			continue
		}

		try {
			return await prisma.sharedConversation.create({
				data: {
					...data,
					shareToken,
				},
			})
		} catch (error) {
			if (isUniqueConstraintError(error)) {
				continue
			}

			throw error
		}
	}

	throw new Error('Unable to generate a unique share token')
}

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		const parsed = createShareSchema.safeParse(body)
		if (!parsed.success) {
			return NextResponse.json(
				{ error: 'Invalid input', details: parsed.error.flatten() },
				{ status: 400 }
			)
		}

		const userId = session.user.id
		const {
			conversationId,
			messageSelections,
			title,
			expiresIn,
			allowDownload,
			showTimestamps,
			showModel,
			autoMaskPII,
			summary,
		} = parsed.data

		const conversation = await prisma.conversation.findFirst({
			where: { id: conversationId, userId },
			select: { id: true, title: true },
		})
		if (!conversation) {
			return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
		}

		const allowed = await checkShareRateLimit(userId)
		if (!allowed) {
			return NextResponse.json(
				{ error: 'Rate limit exceeded. Max 10 shares per 24 hours.' },
				{ status: 429 }
			)
		}

		const selectedMessageIds = messageSelections.map((selection) => selection.id)
		const messages = await prisma.message.findMany({
			where: {
				id: { in: selectedMessageIds },
				conversationId,
				role: { in: ['user', 'assistant'] },
			},
			select: {
				id: true,
				role: true,
				content: true,
				model: true,
				createdAt: true,
			},
		})

		if (messages.length !== selectedMessageIds.length) {
			return NextResponse.json(
				{
					error: 'One or more message IDs are invalid or do not belong to this conversation',
				},
				{ status: 400 }
			)
		}

		const orderedMessages = sortMessagesBySelection(messages, messageSelections).map(
			(message) => ({
				...message,
				role: message.role as 'user' | 'assistant',
			})
		)
		if (orderedMessages.length !== selectedMessageIds.length) {
			return NextResponse.json(
				{ error: 'Share selection is incomplete or invalid.' },
				{ status: 400 }
			)
		}

		if (totalContentLength(orderedMessages) > MAX_SHARE_CHARS) {
			return NextResponse.json(
				{ error: 'Selected content is too large to share in one link.' },
				{ status: 400 }
			)
		}

		const payload = buildSharePersistencePayload({
			messages: orderedMessages,
			messageSelections,
			autoMaskPII,
			summary: (summary ?? null) as ShareSummaryData | null,
		})

		const expiresAt = expiresIn
			? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
			: null

		const share = await createShareWithUniqueToken({
				conversationId,
				createdBy: userId,
				selectedMessageIds: JSON.stringify(payload.selectedMessageIds),
				snapshotData: JSON.stringify(payload.snapshots),
				summaryData: payload.summary ? JSON.stringify(payload.summary) : null,
				maskingData: JSON.stringify(payload.maskingData),
				title: title || conversation.title,
				expiresAt,
				allowDownload,
				showTimestamps,
				showModel,
		})

		const origin = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
		return NextResponse.json({
			shareToken: share.shareToken,
			shareUrl: `${origin}/share/${share.shareToken}`,
			expiresAt: share.expiresAt?.toISOString() ?? null,
			messageCount: payload.snapshots.length,
			hasSummary: !!payload.summary,
		})
	} catch (error) {
		logServerError('chat/share', 'create_failed', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

export async function GET(request: Request) {
	try {
		const rateLimit = await checkRequestRateLimit(request, {
			bucket: 'share-list',
			maxRequests: 60,
			windowSeconds: 60,
			error: 'Too many share requests. Please try again later.',
			errorCode: 'SHARE_RATE_LIMIT_EXCEEDED',
			scope: 'chat/share',
		})
		if (!rateLimit.allowed) {
			return rateLimit.response
		}

		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const userId = session.user.id
		const origin = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

		const shares = await prisma.sharedConversation.findMany({
			where: { createdBy: userId, isActive: true },
			include: {
				conversation: { select: { title: true } },
			},
			orderBy: { createdAt: 'desc' },
		})

		return NextResponse.json({
			shares: shares.map((share) => ({
				id: share.id,
				shareToken: share.shareToken,
				shareUrl: `${origin}/share/${share.shareToken}`,
				title: share.title,
				conversationTitle: share.conversation.title,
				messageCount: (JSON.parse(share.selectedMessageIds) as string[]).length,
				accessCount: share.accessCount,
				expiresAt: share.expiresAt?.toISOString() ?? null,
				allowDownload: share.allowDownload,
				showTimestamps: share.showTimestamps,
				showModel: share.showModel,
				hasSummary: !!share.summaryData,
				createdAt: share.createdAt.toISOString(),
			})),
		})
	} catch (error) {
		logServerError('chat/share', 'list_failed', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

function generateToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(8))
	return Array.from(bytes)
		.map((value) => value.toString(36).padStart(2, '0'))
		.join('')
		.slice(0, 10)
}
