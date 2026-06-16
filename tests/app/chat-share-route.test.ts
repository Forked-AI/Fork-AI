import { GET, POST } from '@/app/api/chat/share/route'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}))
const prismaMocks = vi.hoisted(() => ({
	conversationFindFirst: vi.fn(),
	messageFindMany: vi.fn(),
	sharedCount: vi.fn(),
	sharedCreate: vi.fn(),
	sharedFindUnique: vi.fn(),
	sharedFindMany: vi.fn(),
}))
const shareServiceMocks = vi.hoisted(() => ({
	buildSharePersistencePayload: vi.fn(),
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
		conversation: {
			findFirst: prismaMocks.conversationFindFirst,
		},
		message: {
			findMany: prismaMocks.messageFindMany,
		},
		sharedConversation: {
			count: prismaMocks.sharedCount,
			create: prismaMocks.sharedCreate,
			findUnique: prismaMocks.sharedFindUnique,
			findMany: prismaMocks.sharedFindMany,
		},
	},
}))

vi.mock('@/lib/share/service', () => ({
	buildSharePersistencePayload: shareServiceMocks.buildSharePersistencePayload,
}))

vi.mock('@/lib/idempotency', () => ({
	getUserIdempotencyActorKey: vi.fn((userId: string) => `user:${userId}`),
	withJsonIdempotency: vi.fn(
		async (_request: Request, _options: unknown, handler: () => Promise<unknown>) => {
			const result = (await handler()) as {
				body: unknown
				status?: number
				headers?: HeadersInit
			}

			return Response.json(result.body, {
				status: result.status ?? 200,
				headers: result.headers,
			})
		}
	),
}))

vi.mock('next/headers', () => ({
	headers: async () => new Headers(),
}))

describe('/api/chat/share route', () => {
	beforeEach(() => {
		authMocks.getSession.mockReset()
		prismaMocks.conversationFindFirst.mockReset()
		prismaMocks.messageFindMany.mockReset()
		prismaMocks.sharedCount.mockReset()
		prismaMocks.sharedCreate.mockReset()
		prismaMocks.sharedFindUnique.mockReset()
		prismaMocks.sharedFindMany.mockReset()
		shareServiceMocks.buildSharePersistencePayload.mockReset()

		process.env.NEXT_PUBLIC_BASE_URL = 'https://fork.ai'
		authMocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
		prismaMocks.conversationFindFirst.mockResolvedValue({
			id: 'conversation-1',
			title: 'Thread title',
		})
		prismaMocks.sharedCount.mockResolvedValue(0)
		prismaMocks.sharedFindUnique.mockResolvedValue(null)
	})

	it('rejects unauthenticated share creation', async () => {
		authMocks.getSession.mockResolvedValue(null)

		const response = await POST(
			new Request('http://localhost/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})
		)

		expect(response.status).toBe(401)
		await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
	})

	it('rejects invalid share input', async () => {
		const response = await POST(
			new Request('http://localhost/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: '',
					messageSelections: [],
				}),
			})
		)

		expect(response.status).toBe(400)
		await expect(response.json()).resolves.toMatchObject({
			error: 'Invalid input',
		})
	})

	it('enforces conversation ownership before sharing', async () => {
		prismaMocks.conversationFindFirst.mockResolvedValue(null)

		const response = await POST(
			new Request('http://localhost/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: 'conversation-1',
					messageSelections: [{ id: 'message-1' }],
				}),
			})
		)

		expect(response.status).toBe(404)
		await expect(response.json()).resolves.toEqual({ error: 'Conversation not found' })
	})

	it('rejects selections whose combined content is too large', async () => {
		prismaMocks.messageFindMany.mockResolvedValue([
			{
				id: 'message-1',
				role: 'user',
				content: 'x'.repeat(50001),
				model: null,
				createdAt: new Date('2026-04-08T10:00:00.000Z'),
			},
		])

		const response = await POST(
			new Request('http://localhost/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: 'conversation-1',
					messageSelections: [{ id: 'message-1' }],
				}),
			})
		)

		expect(response.status).toBe(400)
		await expect(response.json()).resolves.toEqual({
			error: 'Selected content is too large to share in one link.',
		})
		expect(shareServiceMocks.buildSharePersistencePayload).not.toHaveBeenCalled()
	})

	it('rate limits share creation after 10 links in 24 hours', async () => {
		prismaMocks.sharedCount.mockResolvedValue(10)

		const response = await POST(
			new Request('http://localhost/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: 'conversation-1',
					messageSelections: [{ id: 'message-1' }],
				}),
			})
		)

		expect(response.status).toBe(429)
		await expect(response.json()).resolves.toEqual({
			error: 'Rate limit exceeded. Max 10 shares per 24 hours.',
		})
	})

	it('creates a share link and serializes the response payload', async () => {
		prismaMocks.messageFindMany.mockResolvedValue([
			{
				id: 'message-1',
				role: 'user',
				content: 'Prompt',
				model: null,
				createdAt: new Date('2026-04-08T10:00:00.000Z'),
			},
			{
				id: 'message-2',
				role: 'assistant',
				content: 'Reply',
				model: 'gpt-5',
				createdAt: new Date('2026-04-08T10:01:00.000Z'),
			},
		])
		shareServiceMocks.buildSharePersistencePayload.mockReturnValue({
			selectedMessageIds: ['message-1', 'message-2'],
			snapshots: [
				{
					id: 'message-1',
					role: 'user',
					content: 'Prompt',
					createdAt: '2026-04-08T10:00:00.000Z',
					orderIndex: 1,
				},
				{
					id: 'message-2',
					role: 'assistant',
					content: 'Reply',
					model: 'gpt-5',
					createdAt: '2026-04-08T10:01:00.000Z',
					orderIndex: 2,
				},
			],
			summary: null,
			maskingData: {
				enabled: true,
				findingsByMessageId: {},
				approvedFindingIdsByMessageId: {},
				redactedMessageIds: [],
			},
		})
		prismaMocks.sharedCreate.mockImplementation(async ({ data }) => ({
			shareToken: data.shareToken,
			expiresAt: data.expiresAt,
		}))

		const response = await POST(
			new Request('http://localhost/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: 'conversation-1',
					messageSelections: [
						{ id: 'message-1', approvedFindingIds: [], redactWholeMessage: false },
						{ id: 'message-2', approvedFindingIds: [], redactWholeMessage: false },
					],
					title: 'Shared thread',
					expiresIn: 7,
					allowDownload: true,
					showTimestamps: false,
					showModel: true,
					autoMaskPII: true,
					summary: null,
				}),
			})
		)

		expect(response.status).toBe(200)
		const payload = await response.json()
		expect(payload).toMatchObject({
			shareToken: expect.any(String),
			shareUrl: expect.stringMatching(/^https:\/\/fork\.ai\/share\//),
			messageCount: 2,
			hasSummary: false,
		})
		expect(prismaMocks.sharedCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				conversationId: 'conversation-1',
				createdBy: 'user-1',
				title: 'Shared thread',
				allowDownload: true,
				showTimestamps: false,
				showModel: true,
			}),
		})
	})

	it('retries share token generation when a collision is detected', async () => {
		prismaMocks.messageFindMany.mockResolvedValue([
			{
				id: 'message-1',
				role: 'user',
				content: 'Prompt',
				model: null,
				createdAt: new Date('2026-04-08T10:00:00.000Z'),
			},
		])
		shareServiceMocks.buildSharePersistencePayload.mockReturnValue({
			selectedMessageIds: ['message-1'],
			snapshots: [
				{
					id: 'message-1',
					role: 'user',
					content: 'Prompt',
					createdAt: '2026-04-08T10:00:00.000Z',
					orderIndex: 1,
				},
			],
			summary: null,
			maskingData: {
				enabled: true,
				findingsByMessageId: {},
				approvedFindingIdsByMessageId: {},
				redactedMessageIds: [],
			},
		})
		prismaMocks.sharedFindUnique
			.mockResolvedValueOnce({ id: 'existing-share' })
			.mockResolvedValueOnce(null)
		prismaMocks.sharedCreate.mockImplementation(async ({ data }) => ({
			shareToken: data.shareToken,
			expiresAt: data.expiresAt,
		}))

		const response = await POST(
			new Request('http://localhost/api/chat/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: 'conversation-1',
					messageSelections: [{ id: 'message-1' }],
				}),
			})
		)

		expect(response.status).toBe(200)
		expect(prismaMocks.sharedFindUnique).toHaveBeenCalledTimes(2)
		expect(prismaMocks.sharedCreate).toHaveBeenCalledTimes(1)
	})

	it('rejects unauthenticated share listing', async () => {
		authMocks.getSession.mockResolvedValue(null)

		const response = await GET(new Request('http://localhost/api/chat/share'))

		expect(response.status).toBe(401)
		await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
	})

	it('lists the owner shares with serialized metadata', async () => {
		prismaMocks.sharedFindMany.mockResolvedValue([
			{
				id: 'share-1',
				shareToken: 'token-1',
				title: 'Public recap',
				selectedMessageIds: JSON.stringify(['message-1', 'message-2']),
				accessCount: 9,
				expiresAt: new Date('2026-04-15T00:00:00.000Z'),
				allowDownload: true,
				showTimestamps: true,
				showModel: false,
				summaryData: JSON.stringify({ overview: 'Summary' }),
				createdAt: new Date('2026-04-08T00:00:00.000Z'),
				conversation: {
					title: 'Source thread',
				},
			},
		])

		const response = await GET(new Request('http://localhost/api/chat/share'))

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toEqual({
			shares: [
				{
					id: 'share-1',
					shareToken: 'token-1',
					shareUrl: 'https://fork.ai/share/token-1',
					title: 'Public recap',
					conversationTitle: 'Source thread',
					messageCount: 2,
					accessCount: 9,
					expiresAt: '2026-04-15T00:00:00.000Z',
					allowDownload: true,
					showTimestamps: true,
					showModel: false,
					hasSummary: true,
					createdAt: '2026-04-08T00:00:00.000Z',
				},
			],
		})
	})
})
