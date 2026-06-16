/**
 * Tests for lib/export-utils.ts
 * Covers exportAsMarkdown, exportAsJSON, exportAsText.
 */

import type { Message } from '@/hooks/use-chat';
import { exportAsJSON, exportAsMarkdown, exportAsText } from '@/lib/export-utils';
import { describe, expect, it } from 'vitest';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
function makeMsg(overrides: Partial<Message> & { id: string; role: Message['role']; content: string }): Message {
	return {
		createdAt: new Date('2024-01-01T10:00:00Z'),
		parentMessageId: null,
		...overrides,
	}
}

const userMsg = makeMsg({ id: 'u1', role: 'user', content: 'What is Fork.AI?' })
const assistantMsg = makeMsg({
	id: 'a1',
	role: 'assistant',
	content: 'Fork.AI is an awesome app.',
	model: 'mistral-large',
	parentMessageId: 'u1',
})
const errorMsg = makeMsg({ id: 'e1', role: 'assistant', content: 'Failed', isError: true })
const messages: Message[] = [userMsg, assistantMsg]

// ─── exportAsMarkdown ─────────────────────────────────────────────────────────
describe('exportAsMarkdown', () => {
	it('starts with the title as H1', () => {
		const md = exportAsMarkdown(messages, { title: 'My Chat', includeTimestamps: false })
		expect(md).toMatch(/^# My Chat/)
	})

	it('uses default title when not specified', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false })
		expect(md).toContain('# Conversation Export')
	})

	it('includes user role icon and label', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false })
		expect(md).toContain('### 👤 User')
	})

	it('includes assistant role icon and label', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false })
		expect(md).toContain('### 🤖 Assistant')
	})

	it('includes model name when includeModel is true', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false, includeModel: true })
		expect(md).toContain('mistral-large')
	})

	it('omits model when includeModel is false', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false, includeModel: false })
		expect(md).not.toContain('mistral-large')
	})

	it('includes message content', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false })
		expect(md).toContain('What is Fork.AI?')
		expect(md).toContain('Fork.AI is an awesome app.')
	})

	it('includes error indicator for error messages', () => {
		const md = exportAsMarkdown([errorMsg], { includeTimestamps: false })
		expect(md).toContain('failed to generate')
	})

	it('includes timestamps section when includeTimestamps is true', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: true })
		expect(md).toContain('**Message Count:** 2')
	})

	it('adds separators between messages', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false })
		expect(md).toContain('---')
	})

	it('returns minimal output for empty messages', () => {
		const md = exportAsMarkdown([], { title: 'Empty', includeTimestamps: false })
		expect(md).toContain('# Empty')
		expect(md).not.toContain('👤')
	})
})

// ─── exportAsJSON ─────────────────────────────────────────────────────────────
describe('exportAsJSON', () => {
	it('produces valid JSON', () => {
		const json = exportAsJSON(messages)
		expect(() => JSON.parse(json)).not.toThrow()
	})

	it('includes the correct message count', () => {
		const parsed = JSON.parse(exportAsJSON(messages))
		expect(parsed.messageCount).toBe(2)
	})

	it('includes all message ids', () => {
		const parsed = JSON.parse(exportAsJSON(messages))
		const ids = parsed.messages.map((m: { id: string }) => m.id)
		expect(ids).toContain('u1')
		expect(ids).toContain('a1')
	})

	it('includes role, content per message', () => {
		const parsed = JSON.parse(exportAsJSON(messages))
		const user = parsed.messages.find((m: { id: string }) => m.id === 'u1')
		expect(user.role).toBe('user')
		expect(user.content).toBe('What is Fork.AI?')
	})

	it('includes model for assistant messages', () => {
		const parsed = JSON.parse(exportAsJSON(messages))
		const asst = parsed.messages.find((m: { id: string }) => m.id === 'a1')
		expect(asst.model).toBe('mistral-large')
	})

	it('includes isError field', () => {
		const parsed = JSON.parse(exportAsJSON([errorMsg]))
		expect(parsed.messages[0].isError).toBe(true)
	})

	it('uses custom title', () => {
		const parsed = JSON.parse(exportAsJSON(messages, { title: 'Custom Title' }))
		expect(parsed.title).toBe('Custom Title')
	})

	it('includes exportedAt ISO timestamp', () => {
		const parsed = JSON.parse(exportAsJSON(messages))
		expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt)
	})

	it('handles empty messages', () => {
		const parsed = JSON.parse(exportAsJSON([]))
		expect(parsed.messageCount).toBe(0)
		expect(parsed.messages).toHaveLength(0)
	})
})

// ─── exportAsText ─────────────────────────────────────────────────────────────
describe('exportAsText', () => {
	it('starts with the title', () => {
		const text = exportAsText(messages, { title: 'My Export', includeTimestamps: false })
		expect(text).toMatch(/^My Export/)
	})

	it('includes USER label for user messages', () => {
		const text = exportAsText(messages, { includeTimestamps: false })
		expect(text).toContain('USER')
	})

	it('includes ASSISTANT label for assistant messages', () => {
		const text = exportAsText(messages, { includeTimestamps: false })
		expect(text).toContain('ASSISTANT')
	})

	it('includes message content', () => {
		const text = exportAsText(messages, { includeTimestamps: false })
		expect(text).toContain('What is Fork.AI?')
		expect(text).toContain('Fork.AI is an awesome app.')
	})

	it('includes model info when enabled', () => {
		const text = exportAsText(messages, { includeTimestamps: false, includeModel: true })
		expect(text).toContain('mistral-large')
	})

	it('omits model when disabled', () => {
		const text = exportAsText(messages, { includeTimestamps: false, includeModel: false })
		expect(text).not.toContain('mistral-large')
	})

	it('includes separator dashes between messages', () => {
		const text = exportAsText(messages, { includeTimestamps: false })
		expect(text).toContain('--------------------------------------------------')
	})

	it('flags error messages', () => {
		const text = exportAsText([errorMsg], { includeTimestamps: false })
		expect(text).toContain('[!] This message failed to generate')
	})

	it('includes export metadata when includeTimestamps is true', () => {
		const text = exportAsText(messages, { includeTimestamps: true })
		expect(text).toContain('Message Count: 2')
	})

	it('handles empty messages list', () => {
		const text = exportAsText([], { title: 'Empty', includeTimestamps: false })
		expect(text).toContain('Empty')
		expect(text).not.toContain('USER')
	})
})

// ─── Edge cases: exportAsMarkdown ────────────────────────────────────────────
describe('exportAsMarkdown — edge cases', () => {
	it('system role uses ⚙️ icon and System label', () => {
		const systemMsg = makeMsg({ id: 's1', role: 'system', content: 'You are helpful.' })
		const md = exportAsMarkdown([systemMsg], { includeTimestamps: false })
		expect(md).toContain('⚙️')
		expect(md).toContain('System')
	})

	it('single message has no separator (---)', () => {
		const md = exportAsMarkdown([userMsg], { includeTimestamps: false })
		// Separator is only added between messages, not after the last one
		const separatorCount = (md.match(/^---$/gm) ?? []).length
		expect(separatorCount).toBe(0)
	})

	it('content with markdown special characters is included verbatim', () => {
		const tricky = makeMsg({ id: 'tricky', role: 'user', content: '**bold** and # heading' })
		const md = exportAsMarkdown([tricky], { includeTimestamps: false })
		expect(md).toContain('**bold** and # heading')
	})

	it('message with undefined createdAt does not break export', () => {
		const noDate = makeMsg({ id: 'nd', role: 'user', content: 'no date' })
		delete (noDate as Partial<Message>).createdAt
		expect(() => exportAsMarkdown([noDate as Message], { includeTimestamps: true })).not.toThrow()
	})

	it('parentMessageId is not exposed in markdown output', () => {
		const md = exportAsMarkdown(messages, { includeTimestamps: false })
		expect(md).not.toContain('parentMessageId')
	})
})

// ─── Edge cases: exportAsJSON ─────────────────────────────────────────────────
describe('exportAsJSON — edge cases', () => {
	it('unicode and emoji in content survive JSON round-trip', () => {
		const emojiMsg = makeMsg({ id: 'emoji', role: 'user', content: '🌸 こんにちは 🎉' })
		const parsed = JSON.parse(exportAsJSON([emojiMsg]))
		expect(parsed.messages[0].content).toBe('🌸 こんにちは 🎉')
	})

	it('parentMessageId is preserved per message', () => {
		const parsed = JSON.parse(exportAsJSON(messages))
		const asst = parsed.messages.find((m: { id: string }) => m.id === 'a1')
		expect(asst.parentMessageId).toBe('u1')
	})

	it('message with no optional fields (model: undefined) exports cleanly', () => {
		const simple = makeMsg({ id: 'plain', role: 'user', content: 'plain msg' })
		expect(() => JSON.parse(exportAsJSON([simple]))).not.toThrow()
	})

	it('createdAt is serialized as an ISO string or numeric timestamp', () => {
		const parsed = JSON.parse(exportAsJSON([userMsg]))
		const createdAt = parsed.messages[0].createdAt
		// Should be a string or number, not an object
		expect(['string', 'number']).toContain(typeof createdAt)
	})

	it('isError=false is included in the output', () => {
		const parsed = JSON.parse(exportAsJSON([userMsg]))
		expect('isError' in parsed.messages[0]).toBe(true)
	})
})

// ─── Edge cases: exportAsText ─────────────────────────────────────────────────
describe('exportAsText — edge cases', () => {
	it('system role outputs SYSTEM label', () => {
		const systemMsg = makeMsg({ id: 'sys', role: 'system', content: 'System prompt.' })
		const text = exportAsText([systemMsg], { includeTimestamps: false })
		expect(text).toContain('SYSTEM')
	})

	it('single message has no separator line', () => {
		const text = exportAsText([userMsg], { includeTimestamps: false })
		const sepCount = (text.match(/^-{50}$/gm) ?? []).length
		expect(sepCount).toBe(0)
	})

	it('content with embedded newlines is preserved in output', () => {
		const multiline = makeMsg({ id: 'ml', role: 'user', content: 'Line 1\nLine 2\nLine 3' })
		const text = exportAsText([multiline], { includeTimestamps: false })
		expect(text).toContain('Line 1\nLine 2\nLine 3')
	})

	it('message with no createdAt does not throw', () => {
		const noDate = makeMsg({ id: 'nd2', role: 'user', content: 'no date text' })
		delete (noDate as Partial<Message>).createdAt
		expect(() => exportAsText([noDate as Message], { includeTimestamps: true })).not.toThrow()
	})

	it('two messages produce exactly one separator', () => {
		const text = exportAsText(messages, { includeTimestamps: false })
		const sepCount = (text.match(/^-{50}$/gm) ?? []).length
		expect(sepCount).toBe(1)
	})
})
