/**
 * Tests for lib/graph-adapter.ts
 * Covers messageToGraphNode and messagesToChatGraph conversions.
 */

import { messageToGraphNode, messagesToChatGraph } from '@/lib/graph-adapter'
import { describe, expect, it } from 'vitest'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const baseMessage = {
	id: 'msg-1',
	role: 'user',
	content: 'Hello world',
	parentMessageId: null as string | null,
	positionX: null as number | null,
	positionY: null as number | null,
	createdAt: new Date('2024-01-01T12:00:00Z'),
	isRootNode: false,
	rootNodeName: null as string | null,
	model: null as string | null,
	isError: false,
}

// ─── messageToGraphNode ───────────────────────────────────────────────────────
describe('messageToGraphNode', () => {
	it('maps id correctly', () => {
		const node = messageToGraphNode(baseMessage)
		expect(node.id).toBe('msg-1')
	})

	it('maps content to text', () => {
		const node = messageToGraphNode(baseMessage)
		expect(node.text).toBe('Hello world')
	})

	it('maps parentMessageId to both replyTo and parentMessageId', () => {
		const msg = { ...baseMessage, parentMessageId: 'parent-id' }
		const node = messageToGraphNode(msg)
		expect(node.replyTo).toBe('parent-id')
		expect(node.parentMessageId).toBe('parent-id')
	})

	it('maps null parentMessageId to null replyTo', () => {
		const node = messageToGraphNode(baseMessage)
		expect(node.replyTo).toBeNull()
		expect(node.parentMessageId).toBeNull()
	})

	it('defaults positionX/Y of null to 0', () => {
		const node = messageToGraphNode(baseMessage)
		expect(node.x).toBe(0)
		expect(node.y).toBe(0)
	})

	it('preserves explicit position values', () => {
		const msg = { ...baseMessage, positionX: 100, positionY: 200 }
		const node = messageToGraphNode(msg)
		expect(node.x).toBe(100)
		expect(node.y).toBe(200)
	})

	it('converts createdAt Date to unix timestamp number', () => {
		const date = new Date('2024-06-15T09:30:00Z')
		const node = messageToGraphNode({ ...baseMessage, createdAt: date })
		expect(node.createdAt).toBe(date.getTime())
	})

	it('maps role correctly', () => {
		const node = messageToGraphNode({ ...baseMessage, role: 'assistant' })
		expect(node.role).toBe('assistant')
	})

	it('carries over model field', () => {
		const node = messageToGraphNode({ ...baseMessage, model: 'mistral-large' })
		expect(node.model).toBe('mistral-large')
	})

	it('carries over isError field', () => {
		const node = messageToGraphNode({ ...baseMessage, isError: true })
		expect(node.isError).toBe(true)
	})

	it('carries over rootNodeName field', () => {
		const node = messageToGraphNode({
			...baseMessage,
			isRootNode: true,
			rootNodeName: 'Root conversation',
		})
		expect(node.isRootNode).toBe(true)
		expect(node.rootNodeName).toBe('Root conversation')
	})
})

// ─── messagesToChatGraph ──────────────────────────────────────────────────────
describe('messagesToChatGraph', () => {
	const messages = [
		{ ...baseMessage, id: 'msg-1' },
		{ ...baseMessage, id: 'msg-2', parentMessageId: 'msg-1', role: 'assistant' },
		{ ...baseMessage, id: 'msg-3', parentMessageId: 'msg-2', role: 'user' },
	]

	it('returns graph with correct conversation id', () => {
		const graph = messagesToChatGraph('conv-abc', messages)
		expect(graph.id).toBe('conv-abc')
	})

	it('returns the correct number of nodes', () => {
		const graph = messagesToChatGraph('conv-abc', messages)
		expect(graph.nodes).toHaveLength(3)
	})

	it('converts all messages to GraphNode format', () => {
		const graph = messagesToChatGraph('conv-abc', messages)
		const ids = graph.nodes.map((n) => n.id)
		expect(ids).toEqual(expect.arrayContaining(['msg-1', 'msg-2', 'msg-3']))
	})

	it('preserves parent links in nodes', () => {
		const graph = messagesToChatGraph('conv-abc', messages)
		const node2 = graph.nodes.find((n) => n.id === 'msg-2')!
		expect(node2.parentMessageId).toBe('msg-1')
		expect(node2.replyTo).toBe('msg-1')
	})

	it('returns empty node list for empty messages', () => {
		const graph = messagesToChatGraph('conv-empty', [])
		expect(graph.nodes).toHaveLength(0)
	})
})

// ─── Edge cases: messageToGraphNode unusual inputs ────────────────────────────
describe('messageToGraphNode — edge cases', () => {
	it('positionX=0 should map to x=0 (not be discarded as falsy)', () => {
		const msg = { ...baseMessage, positionX: 0, positionY: 0 }
		const node = messageToGraphNode(msg)
		// 0 is a valid explicit position, not "missing"
		expect(node.x).toBe(0)
		expect(node.y).toBe(0)
	})

	it('negative positionX and positionY are preserved', () => {
		const msg = { ...baseMessage, positionX: -100, positionY: -50 }
		const node = messageToGraphNode(msg)
		expect(node.x).toBe(-100)
		expect(node.y).toBe(-50)
	})

	it('maps empty string content to empty string text', () => {
		const node = messageToGraphNode({ ...baseMessage, content: '' })
		expect(node.text).toBe('')
	})

	it('preserves unicode and emoji content', () => {
		const node = messageToGraphNode({ ...baseMessage, content: 'こんにちは 🌸 مرحبا' })
		expect(node.text).toBe('こんにちは 🌸 مرحبا')
	})

	it('maps system role correctly', () => {
		const node = messageToGraphNode({ ...baseMessage, role: 'system' })
		expect(node.role).toBe('system')
	})

	it('uses null for null model', () => {
		const node = messageToGraphNode({ ...baseMessage, model: null })
		expect(node.model).toBeNull()
	})

	it('isError false is preserved', () => {
		const node = messageToGraphNode({ ...baseMessage, isError: false })
		expect(node.isError).toBe(false)
	})

	it('very large createdAt date survives conversion', () => {
		const farFuture = new Date('9999-12-31T23:59:59Z')
		const node = messageToGraphNode({ ...baseMessage, createdAt: farFuture })
		expect(node.createdAt).toBe(farFuture.getTime())
	})
})

// ─── Edge cases: messagesToChatGraph unusual inputs ──────────────────────────
describe('messagesToChatGraph — edge cases', () => {
	it('single message graph has exactly one node', () => {
		const graph = messagesToChatGraph('conv-single', [{ ...baseMessage, id: 'only' }])
		expect(graph.nodes).toHaveLength(1)
		expect(graph.nodes[0].id).toBe('only')
	})

	it('conversation id with special characters is preserved', () => {
		const id = 'conv/special?id=1&type=chat'
		const graph = messagesToChatGraph(id, [])
		expect(graph.id).toBe(id)
	})

	it('roles in output match input roles', () => {
		const msgs = [
			{ ...baseMessage, id: 'u', role: 'user' },
			{ ...baseMessage, id: 'a', role: 'assistant', parentMessageId: 'u' },
			{ ...baseMessage, id: 's', role: 'system' },
		]
		const graph = messagesToChatGraph('conv-roles', msgs)
		const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
		expect(byId['u'].role).toBe('user')
		expect(byId['a'].role).toBe('assistant')
		expect(byId['s'].role).toBe('system')
	})

	it('deeply nested chain preserves parent links at every level', () => {
		const chain = ['m0', 'm1', 'm2', 'm3', 'm4'].map((id, i) => ({
			...baseMessage,
			id,
			parentMessageId: i === 0 ? null : `m${i - 1}`,
		}))
		const graph = messagesToChatGraph('conv-chain', chain)
		for (let i = 1; i < chain.length; i++) {
			const node = graph.nodes.find((n) => n.id === `m${i}`)!
			expect(node.parentMessageId).toBe(`m${i - 1}`)
		}
	})
})
