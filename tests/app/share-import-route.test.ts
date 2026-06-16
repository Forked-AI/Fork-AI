import { POST } from '@/app/api/share/[token]/import/route'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}))
const prismaTransactionMocks = vi.hoisted(() => ({
	conversationCreate: vi.fn(),
	messageCreate: vi.fn(),
}))
const prismaMocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
	transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
		callback({
			conversation: { create: prismaTransactionMocks.conversationCreate },
			message: { create: prismaTransactionMocks.messageCreate },
		})
	),
}))
const rateLimitMocks = vi.hoisted(() => ({
	checkRequestRateLimit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
	auth: {
		api: {
			getSession: authMocks.getSession,
		},
	},
}))

vi.mock('@/lib/prisma', () => ({
	prisma: {
		sharedConversation: {
			findUnique: prismaMocks.findUnique,
		},
		$transaction: prismaMocks.transaction,
	},
}))

vi.mock('@/lib/api-rate-limit', () => ({
	checkRequestRateLimit: rateLimitMocks.checkRequestRateLimit,
}))

vi.mock('@/lib/idempotency', () => ({
	getUserIdempotencyActorKey: vi.fn((userId: string) => `user:${userId}`),
	withJsonIdempotency: vi.fn(
		async (_request: Request, _options: unknown, handler: () => Promise<unknown>) => {
			const result = (await handler()) as { body: unknown; status?: number }
			return Response.json(result.body, { status: result.status ?? 200 })
		}
	),
}))

vi.mock('next/headers', () => ({
	headers: async () => new Headers(),
}))

describe('POST /api/share/[token]/import', () => {
	beforeEach(() => {
		authMocks.getSession.mockReset()
		prismaMocks.findUnique.mockReset()
		prismaMocks.transaction.mockClear()
		prismaTransactionMocks.conversationCreate.mockReset()
		prismaTransactionMocks.messageCreate.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockResolvedValue({
			allowed: true,
			state: {
				allowed: true,
				remaining: 19,
				resetAt: new Date('2026-04-08T01:00:00.000Z'),
			},
			identityHash: 'identity',
		})
	})

	it('rejects unauthenticated imports', async () => {
		authMocks.getSession.mockResolvedValue(null)

		const response = await POST(new Request('http://localhost/api/share/token-1/import'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(401)
		await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
	})

	it('rate limits share imports before auth lookup', async () => {
		rateLimitMocks.checkRequestRateLimit.mockResolvedValueOnce({
			allowed: false,
			response: Response.json(
				{
					error: 'Too many share import requests. Please try again later.',
					errorCode: 'SHARE_IMPORT_RATE_LIMIT_EXCEEDED',
					retryAfterSeconds: 60,
				},
				{ status: 429, headers: { 'Retry-After': '60' } }
			),
			state: {
				allowed: false,
				remaining: 0,
				resetAt: new Date('2026-04-08T01:00:00.000Z'),
				retryAfterSeconds: 60,
			},
			identityHash: 'identity',
		})

		const response = await POST(new Request('http://localhost/api/share/token-1/import'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(429)
		expect(authMocks.getSession).not.toHaveBeenCalled()
		expect(prismaMocks.findUnique).not.toHaveBeenCalled()
	})

	it('returns the original conversation for the owner without importing', async () => {
		authMocks.getSession.mockResolvedValue({ user: { id: 'owner-1' } })
		prismaMocks.findUnique.mockResolvedValue({
			shareToken: 'token-1',
			conversationId: 'conversation-1',
			createdBy: 'owner-1',
			isActive: true,
			expiresAt: null,
		})

		const response = await POST(new Request('http://localhost/api/share/token-1/import'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toEqual({
			conversationId: 'conversation-1',
			imported: false,
		})
		expect(prismaMocks.transaction).not.toHaveBeenCalled()
	})

	it('imports shared snapshots into a new linear conversation for non-owners', async () => {
		authMocks.getSession.mockResolvedValue({ user: { id: 'viewer-2' } })
		prismaMocks.findUnique.mockResolvedValue({
			shareToken: 'token-1',
			conversationId: 'conversation-1',
			createdBy: 'owner-1',
			title: 'Ethereum share',
			isActive: true,
			expiresAt: null,
			snapshotData: JSON.stringify([
				{
					id: 'assistant-2',
					role: 'assistant',
					content: 'Second reply',
					model: 'mistral-large-latest',
					createdAt: '2026-04-08T10:02:00.000Z',
					orderIndex: 2,
				},
				{
					id: 'user-1',
					role: 'user',
					content: 'First prompt',
					model: undefined,
					createdAt: '2026-04-08T10:00:00.000Z',
					orderIndex: 1,
				},
			]),
		})
		prismaTransactionMocks.conversationCreate.mockResolvedValue({
			id: 'imported-conversation-1',
		})
		let createdMessageIndex = 0
		prismaTransactionMocks.messageCreate.mockImplementation(async ({ data }) => {
			createdMessageIndex += 1
			return {
				id: `imported-message-${createdMessageIndex}`,
				...data,
			}
		})

		const response = await POST(new Request('http://localhost/api/share/token-1/import'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toEqual({
			conversationId: 'imported-conversation-1',
			imported: true,
		})
		expect(prismaTransactionMocks.conversationCreate).toHaveBeenCalledWith({
			data: {
				title: 'Ethereum share',
				userId: 'viewer-2',
			},
		})
		expect(prismaTransactionMocks.messageCreate).toHaveBeenNthCalledWith(1, {
			data: {
				conversationId: 'imported-conversation-1',
				role: 'user',
				content: 'First prompt',
				model: null,
				parentMessageId: null,
				createdAt: new Date('2026-04-08T10:00:00.000Z'),
			},
		})
		expect(prismaTransactionMocks.messageCreate).toHaveBeenNthCalledWith(2, {
			data: {
				conversationId: 'imported-conversation-1',
				role: 'assistant',
				content: 'Second reply',
				model: 'mistral-large-latest',
				parentMessageId: 'imported-message-1',
				createdAt: new Date('2026-04-08T10:02:00.000Z'),
			},
		})
	})

	it('rejects missing or revoked shares', async () => {
		authMocks.getSession.mockResolvedValue({ user: { id: 'viewer-2' } })
		prismaMocks.findUnique.mockResolvedValue(null)

		const response = await POST(new Request('http://localhost/api/share/token-1/import'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(404)
		await expect(response.json()).resolves.toEqual({
			error: 'Share link not found or has been revoked',
		})
	})

	it('rejects expired shares', async () => {
		authMocks.getSession.mockResolvedValue({ user: { id: 'viewer-2' } })
		prismaMocks.findUnique.mockResolvedValue({
			shareToken: 'token-1',
			conversationId: 'conversation-1',
			createdBy: 'owner-1',
			isActive: true,
			expiresAt: new Date('2020-01-01T00:00:00.000Z'),
		})

		const response = await POST(new Request('http://localhost/api/share/token-1/import'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(410)
		await expect(response.json()).resolves.toEqual({
			error: 'This share link has expired',
		})
	})
})
