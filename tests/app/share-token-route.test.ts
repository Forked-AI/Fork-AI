import { DELETE, GET } from '@/app/api/share/[token]/route'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}))
const prismaMocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
	update: vi.fn(),
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
			update: prismaMocks.update,
		},
	},
}))

vi.mock('@/lib/api-rate-limit', () => ({
	checkRequestRateLimit: rateLimitMocks.checkRequestRateLimit,
}))

vi.mock('next/headers', () => ({
	headers: async () => new Headers(),
}))

describe('/api/share/[token] route', () => {
	beforeEach(() => {
		authMocks.getSession.mockReset()
		prismaMocks.findUnique.mockReset()
		prismaMocks.update.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockResolvedValue({
			allowed: true,
			state: {
				allowed: true,
				remaining: 59,
				resetAt: new Date('2026-04-08T00:01:00.000Z'),
			},
			identityHash: 'identity',
		})
	})

	it('returns 404 for missing or revoked public shares', async () => {
		prismaMocks.findUnique.mockResolvedValue(null)

		const response = await GET(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(404)
		await expect(response.json()).resolves.toEqual({
			error: 'Share link not found or has been revoked',
		})
	})

	it('returns 410 for expired public shares', async () => {
		prismaMocks.findUnique.mockResolvedValue({
			shareToken: 'token-1',
			isActive: true,
			expiresAt: new Date('2020-01-01T00:00:00.000Z'),
		})

		const response = await GET(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(410)
		await expect(response.json()).resolves.toEqual({
			error: 'This share link has expired',
		})
	})

	it('rate limits repeated public share reads', async () => {
		rateLimitMocks.checkRequestRateLimit.mockResolvedValueOnce({
			allowed: false,
			response: Response.json(
				{
					error: 'Too many share requests. Please try again later.',
					errorCode: 'SHARE_RATE_LIMIT_EXCEEDED',
					retryAfterSeconds: 30,
				},
				{ status: 429, headers: { 'Retry-After': '30' } }
			),
			state: {
				allowed: false,
				remaining: 0,
				resetAt: new Date('2026-04-08T00:01:00.000Z'),
				retryAfterSeconds: 30,
			},
			identityHash: 'identity',
		})

		const response = await GET(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(429)
		expect(response.headers.get('Retry-After')).toBe('30')
		await expect(response.json()).resolves.toMatchObject({
			errorCode: 'SHARE_RATE_LIMIT_EXCEEDED',
			retryAfterSeconds: 30,
		})
		expect(prismaMocks.findUnique).not.toHaveBeenCalled()
	})

	it('returns the public payload and increments the access count', async () => {
		prismaMocks.findUnique.mockResolvedValue({
			shareToken: 'token-1',
			title: 'Share title',
			isActive: true,
			expiresAt: null,
			allowDownload: true,
			showTimestamps: false,
			showModel: true,
			createdAt: new Date('2026-04-08T00:00:00.000Z'),
			snapshotData: JSON.stringify([
				{
					id: 'message-1',
					role: 'assistant',
					content: 'Reply',
					model: 'gpt-5',
					createdAt: '2026-04-08T00:00:00.000Z',
					orderIndex: 1,
				},
			]),
			summaryData: JSON.stringify({
				overview: 'Summary',
				keyPoints: ['Point'],
				model: 'gpt-5',
				generatedAt: '2026-04-08T00:00:00.000Z',
			}),
		})
		prismaMocks.update.mockResolvedValue({})

		const response = await GET(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toEqual({
			shareToken: 'token-1',
			title: 'Share title',
			summary: {
				overview: 'Summary',
				keyPoints: ['Point'],
				model: 'gpt-5',
				generatedAt: '2026-04-08T00:00:00.000Z',
			},
			messages: [
				{
					id: 'message-1',
					role: 'assistant',
					content: 'Reply',
					model: 'gpt-5',
					createdAt: '2026-04-08T00:00:00.000Z',
					orderIndex: 1,
				},
			],
			settings: {
				allowDownload: true,
				showTimestamps: false,
				showModel: true,
			},
			createdAt: '2026-04-08T00:00:00.000Z',
			expiresAt: null,
		})
		expect(prismaMocks.update).toHaveBeenCalledWith({
			where: { shareToken: 'token-1' },
			data: { accessCount: { increment: 1 } },
		})
	})

	it('rejects unauthenticated revoke requests', async () => {
		authMocks.getSession.mockResolvedValue(null)

		const response = await DELETE(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(401)
		await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
	})

	it('rejects revoke requests for unknown tokens', async () => {
		authMocks.getSession.mockResolvedValue({ user: { id: 'owner-1' } })
		prismaMocks.findUnique.mockResolvedValue(null)

		const response = await DELETE(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(404)
		await expect(response.json()).resolves.toEqual({ error: 'Share link not found' })
	})

	it('rejects revoke requests from non-owners', async () => {
		authMocks.getSession.mockResolvedValue({ user: { id: 'viewer-2' } })
		prismaMocks.findUnique.mockResolvedValue({
			shareToken: 'token-1',
			createdBy: 'owner-1',
		})

		const response = await DELETE(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(403)
		await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
	})

	it('revokes shares for the owner', async () => {
		authMocks.getSession.mockResolvedValue({ user: { id: 'owner-1' } })
		prismaMocks.findUnique.mockResolvedValue({
			shareToken: 'token-1',
			createdBy: 'owner-1',
		})
		prismaMocks.update.mockResolvedValue({})

		const response = await DELETE(new Request('http://localhost/api/share/token-1'), {
			params: Promise.resolve({ token: 'token-1' }),
		})

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			revokedAt: expect.any(String),
		})
		expect(prismaMocks.update).toHaveBeenCalledWith({
			where: { shareToken: 'token-1' },
			data: { isActive: false },
		})
	})
})
