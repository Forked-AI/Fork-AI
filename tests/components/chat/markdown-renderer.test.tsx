import { MarkdownRenderer } from '@/components/chat/markdown-renderer'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
	default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
		React.createElement('img', props),
}))

function renderMarkdown(
	content: string,
	variant?: React.ComponentProps<typeof MarkdownRenderer>['variant']
) {
	return render(React.createElement(MarkdownRenderer, { content, variant }))
}

describe('MarkdownRenderer', () => {
	it('uses compact containment rules for links, tables, and code blocks', () => {
		const content = [
			`<https://example.com/${'very-long-segment-'.repeat(10)}>`,
			'',
			'| Name | Value |',
			'| --- | --- |',
			`| alpha | ${'x'.repeat(80)} |`,
			'',
			'```ts',
			`const token = "${'secret-segment-'.repeat(12)}"`,
			'```',
		].join('\n')

		const { container } = renderMarkdown(content, 'compact')
		const root = container.firstElementChild as HTMLElement
		const table = container.querySelector('table')
		const codeElement = container.querySelector('pre code')
		const link = screen.getByRole('link', { name: /https:\/\/example\.com\// })

		expect(root.className).toContain('min-w-0')
		expect(root.className).toContain('[overflow-wrap:anywhere]')
		expect(link.className).toContain('break-all')
		expect(table?.parentElement?.className).toContain('overflow-x-auto')
		expect(codeElement?.closest('pre')?.parentElement?.className).toContain(
			'overflow-x-auto'
		)
	})

	it('blocks dangerous link protocols and does not render raw HTML', () => {
		const { container } = renderMarkdown(
			[
				'[blocked](javascript:alert(1))',
				'<script>alert("xss")</script>',
				'<img src=x onerror=alert(1)>',
			].join('\n')
		)

		expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
		expect(container.querySelector('script')).toBeNull()
		expect(container.querySelector('img[onerror]')).toBeNull()
		expect(screen.getByText('blocked')).not.toHaveAttribute('href')
	})

	it('adds safe external-link attributes without forcing new tabs for local links', () => {
		renderMarkdown('[external](https://example.com) [local](/settings)')

		const externalLink = screen.getByRole('link', { name: 'external' })
		const localLink = screen.getByRole('link', { name: 'local' })

		expect(externalLink).toHaveAttribute('target', '_blank')
		expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer nofollow')
		expect(localLink).not.toHaveAttribute('target')
		expect(localLink).not.toHaveAttribute('rel')
	})
})
