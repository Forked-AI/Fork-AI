import { POST } from '@/app/api/signup/availability/route'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
	findFirst: vi.fn(),
}))
const rateLimitMocks = vi.hoisted(() => ({
	checkRequestRateLimit: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
	prisma: {
		user: {
			findFirst: prismaMocks.findFirst,
		},
	},
}))

vi.mock('@/lib/api-rate-limit', () => ({
	checkRequestRateLimit: rateLimitMocks.checkRequestRateLimit,
}))

describe('POST /api/signup/availability', () => {
	beforeEach(() => {
		prismaMocks.findFirst.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockReset()
		rateLimitMocks.checkRequestRateLimit.mockResolvedValue({
			allowed: true,
			state: {
				allowed: true,
				remaining: 19,
				resetAt: new Date('2026-04-08T00:01:00.000Z'),
			},
			identityHash: 'identity',
		})
	})

	it('rate limits public availability checks before querying users', async () => {
		rateLimitMocks.checkRequestRateLimit.mockResolvedValueOnce({
			allowed: false,
			response: Response.json(
				{
					error: 'Too many availability checks. Please try again later.',
					errorCode: 'SIGNUP_AVAILABILITY_RATE_LIMIT_EXCEEDED',
					retryAfterSeconds: 10,
				},
				{ status: 429, headers: { 'Retry-After': '10' } }
			),
			state: {
				allowed: false,
				remaining: 0,
				resetAt: new Date('2026-04-08T00:01:00.000Z'),
				retryAfterSeconds: 10,
			},
			identityHash: 'identity',
		})

		const response = await POST(
			new Request('http://localhost/api/signup/availability', {
				method: 'POST',
				body: JSON.stringify({ email: 'viewer@example.com' }),
			})
		)

		expect(response.status).toBe(429)
		expect(prismaMocks.findFirst).not.toHaveBeenCalled()
	})

	it('returns 400 for an invalid email', async () => {
		const response = await POST(
			new Request('http://localhost/api/signup/availability', {
				method: 'POST',
				body: JSON.stringify({ email: 'not-an-email' }),
			})
		)

		expect(response.status).toBe(400)
		await expect(response.json()).resolves.toEqual({
			available: false,
			error: 'Enter a valid email address.',
		})
		expect(prismaMocks.findFirst).not.toHaveBeenCalled()
	})

	it('returns 200 for an unused email', async () => {
		prismaMocks.findFirst.mockResolvedValue(null)

		const response = await POST(
			new Request('http://localhost/api/signup/availability', {
				method: 'POST',
				body: JSON.stringify({ email: 'viewer@example.com' }),
			})
		)

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toEqual({ available: true })
		expect(prismaMocks.findFirst).toHaveBeenCalledWith({
			where: {
				email: {
					equals: 'viewer@example.com',
					mode: 'insensitive',
				},
			},
			select: { id: true },
		})
	})

	it('returns 409 for an existing email', async () => {
		prismaMocks.findFirst.mockResolvedValue({ id: 'user-1' })

		const response = await POST(
			new Request('http://localhost/api/signup/availability', {
				method: 'POST',
				body: JSON.stringify({ email: 'viewer@example.com' }),
			})
		)

		expect(response.status).toBe(409)
		await expect(response.json()).resolves.toEqual({
			available: false,
			error: 'This email is already registered. Use another email or sign in.',
		})
	})

	it('normalizes email whitespace and case before querying', async () => {
		prismaMocks.findFirst.mockResolvedValue(null)

		await POST(
			new Request('http://localhost/api/signup/availability', {
				method: 'POST',
				body: JSON.stringify({ email: ' Viewer@Example.com ' }),
			})
		)

		expect(prismaMocks.findFirst).toHaveBeenCalledWith({
			where: {
				email: {
					equals: 'viewer@example.com',
					mode: 'insensitive',
				},
			},
			select: { id: true },
		})
	})
})
