import nextConfig from '@/next.config.mjs'
import { describe, expect, it } from 'vitest'

describe('Next.js security headers', () => {
	it('sets core hardening headers for all routes', async () => {
		const headers = await nextConfig.headers?.()

		expect(headers?.[0]).toMatchObject({
			source: '/(.*)',
		})
		const headerMap = new Map(
			headers?.[0]?.headers.map((header) => [header.key, header.value])
		)

		expect(headerMap.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
		expect(headerMap.get('X-Frame-Options')).toBe('DENY')
		expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
		expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
		expect(headerMap.get('Permissions-Policy')).toContain('camera=()')
		expect(headerMap.get('Strict-Transport-Security')).toContain('max-age=')
	})
})
