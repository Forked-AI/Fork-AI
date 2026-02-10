/**
 * Utility functions for exporting conversations in various formats
 */

import type { Message } from '@/hooks/use-chat'

export interface ExportOptions {
	title?: string
	includeTimestamps?: boolean
	includeModel?: boolean
	format: 'markdown' | 'json' | 'text'
}

/**
 * Export conversation as Markdown
 */
export function exportAsMarkdown(
	messages: Message[],
	options: Partial<ExportOptions> = {}
): string {
	const {
		title = 'Conversation Export',
		includeTimestamps = true,
		includeModel = true,
	} = options

	let markdown = `# ${title}\n\n`

	if (includeTimestamps && messages.length > 0) {
		const firstMessage = messages[0]
		const lastMessage = messages[messages.length - 1]
		markdown += `**Export Date:** ${new Date().toLocaleString()}\n`
		markdown += `**Message Count:** ${messages.length}\n`
		if (firstMessage.createdAt) {
			markdown += `**Started:** ${new Date(firstMessage.createdAt).toLocaleString()}\n`
		}
		if (lastMessage.createdAt) {
			markdown += `**Last Message:** ${new Date(lastMessage.createdAt).toLocaleString()}\n`
		}
		markdown += `\n---\n\n`
	}

	messages.forEach((message, index) => {
		// Add role indicator
		const roleIcon =
			message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️'
		const roleLabel =
			message.role === 'user'
				? 'User'
				: message.role === 'assistant'
					? 'Assistant'
					: 'System'

		markdown += `### ${roleIcon} ${roleLabel}`

		// Add model info if assistant message
		if (message.role === 'assistant' && includeModel && message.model) {
			markdown += ` _(${message.model})_`
		}

		// Add timestamp if available
		if (includeTimestamps && message.createdAt) {
			markdown += `\n**Time:** ${new Date(message.createdAt).toLocaleString()}`
		}

		markdown += `\n\n`

		// Add message content
		markdown += `${message.content}\n\n`

		// Add error indicator if present
		if (message.isError) {
			markdown += `> ⚠️ _This message failed to generate_\n\n`
		}

		// Add separator between messages
		if (index < messages.length - 1) {
			markdown += `---\n\n`
		}
	})

	return markdown
}

/**
 * Export conversation as JSON
 */
export function exportAsJSON(
	messages: Message[],
	options: Partial<ExportOptions> = {}
): string {
	const { title = 'Conversation Export' } = options

	const exportData = {
		title,
		exportedAt: new Date().toISOString(),
		messageCount: messages.length,
		messages: messages.map((msg) => ({
			id: msg.id,
			role: msg.role,
			content: msg.content,
			model: msg.model || null,
			createdAt: msg.createdAt || null,
			parentMessageId: msg.parentMessageId || null,
			isError: msg.isError || false,
		})),
	}

	return JSON.stringify(exportData, null, 2)
}

/**
 * Export conversation as plain text
 */
export function exportAsText(
	messages: Message[],
	options: Partial<ExportOptions> = {}
): string {
	const {
		title = 'Conversation Export',
		includeTimestamps = true,
		includeModel = true,
	} = options

	let text = `${title}\n${'='.repeat(title.length)}\n\n`

	if (includeTimestamps && messages.length > 0) {
		text += `Export Date: ${new Date().toLocaleString()}\n`
		text += `Message Count: ${messages.length}\n\n`
		text += `${'='.repeat(50)}\n\n`
	}

	messages.forEach((message, index) => {
		// Add role indicator
		const roleLabel =
			message.role === 'user'
				? 'USER'
				: message.role === 'assistant'
					? 'ASSISTANT'
					: 'SYSTEM'

		text += `${roleLabel}`

		// Add model info if assistant message
		if (message.role === 'assistant' && includeModel && message.model) {
			text += ` (${message.model})`
		}

		// Add timestamp if available
		if (includeTimestamps && message.createdAt) {
			text += ` - ${new Date(message.createdAt).toLocaleString()}`
		}

		text += `:\n`

		// Add message content
		text += `${message.content}\n`

		// Add error indicator if present
		if (message.isError) {
			text += `[!] This message failed to generate\n`
		}

		// Add separator between messages
		if (index < messages.length - 1) {
			text += `\n${'-'.repeat(50)}\n\n`
		}
	})

	return text
}

/**
 * Download file with given content
 */
export function downloadFile(
	content: string,
	filename: string,
	mimeType: string = 'text/plain'
) {
	const blob = new Blob([content], { type: mimeType })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

/**
 * Get filename for export
 */
export function getExportFilename(
	title: string,
	format: 'markdown' | 'json' | 'text'
): string {
	// Sanitize title for filename
	const sanitized = title
		.replace(/[^a-z0-9]/gi, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase()
		.slice(0, 50)

	const timestamp = new Date().toISOString().split('T')[0]
	const extension = format === 'markdown' ? 'md' : format === 'text' ? 'txt' : 'json'

	return `${sanitized || 'conversation'}-${timestamp}.${extension}`
}
