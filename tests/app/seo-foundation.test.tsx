import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { homepageSchema, JsonLd } from '@/components/json-ld'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('SEO foundation', () => {
	it('publishes only canonical, indexable static routes in the sitemap', () => {
		const urls = sitemap().map((entry) => entry.url)

		expect(urls).toEqual([
			'https://forkai.tech/',
			'https://forkai.tech/branching-ai-chat',
			'https://forkai.tech/policy',
		])
		expect(urls).not.toEqual(
			expect.arrayContaining([
				'https://forkai.tech/landing',
				'https://forkai.tech/login',
				'https://forkai.tech/signup',
			])
		)
	})

	it('keeps public content crawlable while excluding private application routes', () => {
		const result = robots()

		expect(result.sitemap).toBe('https://forkai.tech/sitemap.xml')
		expect(result.rules).toMatchObject({
			userAgent: '*',
			allow: '/',
			disallow: ['/admin', '/api', '/chat'],
		})
	})

	it('describes the homepage and its multi-provider product positioning', () => {
		const graph = homepageSchema['@graph']
		const types = graph.map((node) => node['@type'])
		const serialized = JSON.stringify(homepageSchema)

		expect(types).toEqual(['Organization', 'WebSite', 'WebApplication'])
		expect(serialized).toMatch(/ChatGPT.*Claude.*Gemini/)
		expect(serialized).not.toMatch(/AggregateRating/)
	})

	it('escapes markup-breaking characters in JSON-LD', () => {
		const { container } = render(
			<JsonLd
				data={{
					'@context': 'https://schema.org',
					'@type': 'Thing',
					name: '</script><script>alert(1)</script>',
				}}
			/>
		)
		const script = container.querySelector('script')

		expect(script?.innerHTML).toContain('\\u003c/script>')
		expect(script?.innerHTML).not.toContain('</script><script>')
	})
})
