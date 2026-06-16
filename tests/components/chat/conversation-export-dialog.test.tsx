import { ConversationExportDialog } from '@/components/chat/conversation-export-dialog'
import type { Message } from '@/hooks/use-chat'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockToast = vi.fn()
const mockDownloadFile = vi.fn()
const mockExportAsMarkdown = vi.fn(
	(_messages: unknown, _options: unknown) => 'markdown-content'
)
const mockExportAsJSON = vi.fn(
	(_messages: unknown, _options: unknown) => '{"ok":true}'
)
const mockExportAsText = vi.fn(
	(_messages: unknown, _options: unknown) => 'plain-text-content'
)
const mockGetExportFilename = vi.fn(
	(_title: string, format: 'markdown' | 'json' | 'text') => `export.${format}`
)

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({
		toast: mockToast,
	}),
}))

vi.mock('@/components/chat/chat-modal-shell', () => ({
	ChatModalShell: ({
		open,
		title,
		children,
	}: {
		open: boolean
		title: React.ReactNode
		children: React.ReactNode
	}) => (open ? <div><h1>{title}</h1>{children}</div> : null),
}))

vi.mock('@/lib/export-utils', () => ({
	downloadFile: (content: string, filename: string, mimeType: string) =>
		mockDownloadFile(content, filename, mimeType),
	exportAsMarkdown: (messages: unknown, options: unknown) =>
		mockExportAsMarkdown(messages, options),
	exportAsJSON: (messages: unknown, options: unknown) =>
		mockExportAsJSON(messages, options),
	exportAsText: (messages: unknown, options: unknown) =>
		mockExportAsText(messages, options),
	getExportFilename: (
		title: string,
		format: 'markdown' | 'json' | 'text'
	) => mockGetExportFilename(title, format),
}))

const messages: Message[] = [
	{
		id: 'msg-1',
		role: 'user',
		content: 'Hello',
		createdAt: new Date('2026-04-07T10:00:00.000Z'),
	},
]

describe('ConversationExportDialog', () => {
	beforeEach(() => {
		mockToast.mockReset()
		mockDownloadFile.mockReset()
		mockExportAsMarkdown.mockClear()
		mockExportAsJSON.mockClear()
		mockExportAsText.mockClear()
		mockGetExportFilename.mockClear()
	})

	it('exports markdown conversations', async () => {
		const user = userEvent.setup()

		render(
			<ConversationExportDialog
				open
				onOpenChange={vi.fn()}
				messages={messages}
				conversationTitle="Export test"
			/>
		)

		await user.click(screen.getByRole('button', { name: 'Markdown' }))

		expect(mockExportAsMarkdown).toHaveBeenCalledWith(messages, {
			title: 'Export test',
			includeTimestamps: true,
			includeModel: true,
		})
		expect(mockDownloadFile).toHaveBeenCalledWith(
			'markdown-content',
			'export.markdown',
			'text/markdown'
		)
	})

	it('exports json conversations', async () => {
		const user = userEvent.setup()

		render(
			<ConversationExportDialog
				open
				onOpenChange={vi.fn()}
				messages={messages}
				conversationTitle="Export test"
			/>
		)

		await user.click(screen.getByRole('button', { name: 'JSON' }))

		expect(mockExportAsJSON).toHaveBeenCalledWith(messages, {
			title: 'Export test',
		})
		expect(mockDownloadFile).toHaveBeenCalledWith(
			'{"ok":true}',
			'export.json',
			'application/json'
		)
	})

	it('exports plain text conversations', async () => {
		const user = userEvent.setup()

		render(
			<ConversationExportDialog
				open
				onOpenChange={vi.fn()}
				messages={messages}
				conversationTitle="Export test"
			/>
		)

		await user.click(screen.getByRole('button', { name: 'Plain Text' }))

		expect(mockExportAsText).toHaveBeenCalledWith(messages, {
			title: 'Export test',
			includeTimestamps: true,
			includeModel: true,
		})
		expect(mockDownloadFile).toHaveBeenCalledWith(
			'plain-text-content',
			'export.text',
			'text/plain'
		)
	})
})
