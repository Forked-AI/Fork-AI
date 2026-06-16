import { checkChatRateLimit } from '@/lib/chat-rate-limit'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redis', () => ({
	redisClient: null,
}))

describe('checkChatRateLimit', () => {
	it('fails open when Redis is not configured', async () => {
		const result = await checkChatRateLimit('identity', {
			bucket: 'test',
			maxRequests: 2,
			windowSeconds: 60,
		})

		expect(result.allowed).toBe(true)
		expect(result.remaining).toBe(2)
	})
})
