import { POST } from '@/app/api/waitlist/route'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
	create: vi.fn(),
}))
const emailMocks = vi.hoisted(() => ({
	sendWelcomeEmail: vi.fn(),
}))
const rateLimitMocks = vi.hoisted(() => ({
	checkRequestRateLimit: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
	prisma: {
		waitlistEntry: {
			findUnique: prismaMocks.findUnique,
			create: prismaMocks.create,
		},
	},
}))

vi.mock('@/lib/email', () => ({
	sendWelcomeEmail: emailMocks.sendWelcomeEmail,
}))

vi.mock('@/lib/api-rate-limit', () => ({
	checkRequestRateLimit: rateLimitMocks.checkRequestRateLimit,
}))

describe('POST /api/waitlist', () => {
	beforeEach(() => {
		prismaMocks.findUnique.mockReset()
		prismaMocks.create.mockReset()
		emailMocks.sendWelcomeEmail.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockResolvedValue({
			allowed: true,
			state: {
				allowed: true,
				remaining: 4,
				resetAt: new Date('2026-04-08T01:00:00.000Z'),
			},
			identityHash: 'identity',
		})
		emailMocks.sendWelcomeEmail.mockResolvedValue({ success: true })
	})

	it('rate limits waitlist requests before database writes', async () => {
		rateLimitMocks.checkRequestRateLimit.mockResolvedValueOnce({
			allowed: false,
			response: Response.json(
				{
					error: 'Too many waitlist requests. Please try again later.',
					errorCode: 'WAITLIST_RATE_LIMIT_EXCEEDED',
					retryAfterSeconds: 30,
				},
				{ status: 429, headers: { 'Retry-After': '30' } }
			),
			state: {
				allowed: false,
				remaining: 0,
				resetAt: new Date('2026-04-08T01:00:00.000Z'),
				retryAfterSeconds: 30,
			},
			identityHash: 'identity',
		})

		const response = await POST(
			new Request('http://localhost/api/waitlist', {
				method: 'POST',
				body: JSON.stringify({ email: 'viewer@example.com' }),
			})
		)

		expect(response.status).toBe(429)
		expect(prismaMocks.create).not.toHaveBeenCalled()
		expect(emailMocks.sendWelcomeEmail).not.toHaveBeenCalled()
	})

	it('creates a waitlist entry when under the limit', async () => {
		prismaMocks.findUnique.mockResolvedValue(null)
		prismaMocks.create.mockResolvedValue({ id: 'entry-1' })

		const response = await POST(
			new Request('http://localhost/api/waitlist', {
				method: 'POST',
				body: JSON.stringify({ email: 'viewer@example.com' }),
			})
		)

		expect(response.status).toBe(201)
		expect(prismaMocks.create).toHaveBeenCalledWith({
			data: { email: 'viewer@example.com' },
		})
		expect(emailMocks.sendWelcomeEmail).toHaveBeenCalledWith('viewer@example.com')
	})
})
