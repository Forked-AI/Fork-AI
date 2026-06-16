/**
 * Tests for hooks/use-message-tree.ts
 * Tests the sibling map construction, path traversal, and ancestor chain logic
 * by rendering the hook with @testing-library/react.
 */

import type { Message } from '@/hooks/use-chat'
import { useMessageTree } from '@/hooks/use-message-tree'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// ─── Helpers ──────────────────────────────────────────────────────────────────
let counter = 0
function msg(
	id: string,
	role: Message['role'],
	content: string,
	parentMessageId: string | null = null,
	tsOffset = 0
): Message {
	return {
		id,
		role,
		content,
		parentMessageId,
		createdAt: new Date(1_700_000_000_000 + tsOffset),
	}
}

/**
 * Linear chain: root → a → b
 */
const LINEAR: Message[] = [
	msg('root', 'user', 'Hi', null, 0),
	msg('a', 'assistant', 'Hello', 'root', 1),
	msg('b', 'user', 'Follow up', 'a', 2),
]

/**
 * Branched tree (branch at root):
 *     root
 *    /    \
 *   a      c       (a created earlier than c)
 *   |
 *   b
 */
const BRANCHED: Message[] = [
	msg('root', 'user', 'Hi', null, 0),
	msg('a', 'assistant', 'Branch A', 'root', 1),
	msg('b', 'user', 'Continue A', 'a', 2),
	msg('c', 'assistant', 'Branch C', 'root', 3), // newer sibling of a
]

/**
 * Legacy flat list (all parentMessageIds null) for backward-compat
 */
const LEGACY: Message[] = [
	msg('l1', 'user', 'First', null, 0),
	msg('l2', 'assistant', 'Second', null, 1),
	msg('l3', 'user', 'Third', null, 2),
]

// ─── siblingsMap ──────────────────────────────────────────────────────────────
describe('siblingsMap construction', () => {
	it('linear: each node has exactly one sibling (itself)', () => {
		const { result } = renderHook(() => useMessageTree(LINEAR))
		// root is child of null
		expect(result.current.siblingsMap.get(null)).toHaveLength(1)
		// b is child of a
		expect(result.current.siblingsMap.get('a')).toHaveLength(1)
	})

	it('branched: root has two children (a and c)', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const rootChildren = result.current.siblingsMap.get('root')!
		expect(rootChildren).toHaveLength(2)
		expect(rootChildren.map((m) => m.id)).toEqual(expect.arrayContaining(['a', 'c']))
	})

	it('siblings are sorted by createdAt ascending', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const rootChildren = result.current.siblingsMap.get('root')!
		expect(rootChildren[0].id).toBe('a') // older
		expect(rootChildren[1].id).toBe('c') // newer
	})

	it('legacy flat list: infers linear parent-child order', () => {
		const { result } = renderHook(() => useMessageTree(LEGACY))
		// null → [l1]
		expect(result.current.siblingsMap.get(null)!.map((m) => m.id)).toEqual(['l1'])
		// l1 → [l2]
		expect(result.current.siblingsMap.get('l1')!.map((m) => m.id)).toEqual(['l2'])
	})
})

// ─── getSiblings ──────────────────────────────────────────────────────────────
describe('getSiblings', () => {
	it('returns both siblings for a node in a branch', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const siblings = result.current.getSiblings(BRANCHED[1]) // node a
		expect(siblings.map((s) => s.id)).toEqual(expect.arrayContaining(['a', 'c']))
	})

	it('returns only itself for a node with no siblings (linear)', () => {
		const { result } = renderHook(() => useMessageTree(LINEAR))
		const siblings = result.current.getSiblings(LINEAR[2]) // node b
		expect(siblings).toHaveLength(1)
		expect(siblings[0].id).toBe('b')
	})
})

// ─── getSiblingIndex ──────────────────────────────────────────────────────────
describe('getSiblingIndex', () => {
	it('returns 1-based index among sorted siblings', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		// a is first child of root (index 1)
		expect(result.current.getSiblingIndex(BRANCHED[1])).toBe(1)
		// c is second child of root (index 2)
		expect(result.current.getSiblingIndex(BRANCHED[3])).toBe(2)
	})

	it('returns 1 for a single child', () => {
		const { result } = renderHook(() => useMessageTree(LINEAR))
		expect(result.current.getSiblingIndex(LINEAR[0])).toBe(1)
	})
})

// ─── navigateSibling ──────────────────────────────────────────────────────────
describe('navigateSibling', () => {
	it('navigating next from first sibling goes to second', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		act(() => {
			result.current.navigateSibling(BRANCHED[1], 'next') // a → c
		})
		const activeId = result.current.activeMessageIds.get('root')
		expect(activeId).toBe('c')
	})

	it('navigating prev from first sibling wraps to last', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		act(() => {
			result.current.navigateSibling(BRANCHED[1], 'prev') // a → wraps to c
		})
		const activeId = result.current.activeMessageIds.get('root')
		expect(activeId).toBe('c')
	})

	it('navigating prev from last sibling wraps to first', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		// Navigate to c first
		act(() => {
			result.current.navigateSibling(BRANCHED[3], 'prev') // c → a
		})
		const activeId = result.current.activeMessageIds.get('root')
		expect(activeId).toBe('a')
	})

	it('navigating next from last sibling wraps to first', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		act(() => {
			result.current.navigateSibling(BRANCHED[3], 'next') // c → wraps to a
		})
		const activeId = result.current.activeMessageIds.get('root')
		expect(activeId).toBe('a')
	})
})

// ─── getActivePath ────────────────────────────────────────────────────────────
describe('getActivePath', () => {
	it('linear: returns all messages in order', () => {
		const { result } = renderHook(() => useMessageTree(LINEAR))
		const path = result.current.getActivePath(LINEAR)
		expect(path.map((m) => m.id)).toEqual(['root', 'a', 'b'])
	})

	it('branched default: picks newest sibling (c) at branch point', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const path = result.current.getActivePath(BRANCHED)
		// Default should be last sibling (c), and then b is child of a (not c)
		// The newest child of root is c; c has no children → path: root, c
		const ids = path.map((m) => m.id)
		expect(ids[0]).toBe('root')
		expect(ids[1]).toBe('c')
	})

	it('after navigating to a, path goes through a then b', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		act(() => {
			// Navigate from c back to a
			result.current.navigateSibling(BRANCHED[3], 'prev') // makes a the active child of root
		})
		const path = result.current.getActivePath(BRANCHED)
		const ids = path.map((m) => m.id)
		expect(ids).toEqual(['root', 'a', 'b'])
	})

	it('returns empty array for empty messages', () => {
		const { result } = renderHook(() => useMessageTree([]))
		expect(result.current.getActivePath([])).toEqual([])
	})

	it('legacy flat list returns all messages in chronological order', () => {
		const { result } = renderHook(() => useMessageTree(LEGACY))
		const path = result.current.getActivePath(LEGACY)
		expect(path.map((m) => m.id)).toEqual(['l1', 'l2', 'l3'])
	})
})

// ─── getAncestorPath ──────────────────────────────────────────────────────────
describe('getAncestorPath', () => {
	it('returns root → a for node a', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const path = result.current.getAncestorPath(BRANCHED, 'a')
		expect(path.map((m) => m.id)).toEqual(['root', 'a'])
	})

	it('returns root → a → b for node b', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const path = result.current.getAncestorPath(BRANCHED, 'b')
		expect(path.map((m) => m.id)).toEqual(['root', 'a', 'b'])
	})

	it('returns just root for root node', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const path = result.current.getAncestorPath(BRANCHED, 'root')
		expect(path.map((m) => m.id)).toEqual(['root'])
	})

	it('returns [] for unknown node id', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const path = result.current.getAncestorPath(BRANCHED, 'not-exist')
		expect(path).toHaveLength(0)
	})

	it('does NOT include nodes outside the ancestor chain', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		const path = result.current.getAncestorPath(BRANCHED, 'b')
		const ids = path.map((m) => m.id)
		expect(ids).not.toContain('c')
	})
})

// ─── Edge cases: single message tree ─────────────────────────────────────────
describe('single message — edge cases', () => {
	const SINGLE: Message[] = [msg('only', 'user', 'Solo message', null, 0)]

	it('siblingsMap has single root entry with one child', () => {
		const { result } = renderHook(() => useMessageTree(SINGLE))
		expect(result.current.siblingsMap.get(null)).toHaveLength(1)
	})

	it('getSiblings returns only the message itself', () => {
		const { result } = renderHook(() => useMessageTree(SINGLE))
		const siblings = result.current.getSiblings(SINGLE[0])
		expect(siblings).toHaveLength(1)
		expect(siblings[0].id).toBe('only')
	})

	it('getSiblingIndex returns 1', () => {
		const { result } = renderHook(() => useMessageTree(SINGLE))
		expect(result.current.getSiblingIndex(SINGLE[0])).toBe(1)
	})

	it('getActivePath returns the single message', () => {
		const { result } = renderHook(() => useMessageTree(SINGLE))
		const path = result.current.getActivePath(SINGLE)
		expect(path).toHaveLength(1)
		expect(path[0].id).toBe('only')
	})

	it('getAncestorPath of the root is just itself', () => {
		const { result } = renderHook(() => useMessageTree(SINGLE))
		const path = result.current.getAncestorPath(SINGLE, 'only')
		expect(path.map((m) => m.id)).toEqual(['only'])
	})

	it('navigateSibling next on a single node does not crash', () => {
		const { result } = renderHook(() => useMessageTree(SINGLE))
		expect(() => {
			act(() => {
				result.current.navigateSibling(SINGLE[0], 'next')
			})
		}).not.toThrow()
	})
})

// ─── Edge cases: messages with undefined createdAt ────────────────────────────
describe('undefined createdAt — edge cases', () => {
	const makeNoDate = (id: string, parentId: string | null) => {
		const m = msg(id, 'user', `msg-${id}`, parentId, 0)
		delete (m as Partial<Message>).createdAt
		return m as Message
	}

	it('builds siblingsMap without throwing when createdAt is undefined', () => {
		const messages = [makeNoDate('r', null), makeNoDate('a', 'r'), makeNoDate('b', 'r')]
		expect(() => renderHook(() => useMessageTree(messages))).not.toThrow()
	})

	it('getActivePath works when createdAt is undefined', () => {
		const messages = [makeNoDate('r', null), makeNoDate('a', 'r')]
		const { result } = renderHook(() => useMessageTree(messages))
		expect(() => result.current.getActivePath(messages)).not.toThrow()
	})
})

// ─── Edge cases: navigation stability ───────────────────────────────────────
describe('navigation stability', () => {
	it('navigating next on a single child keeps the same active id', () => {
		const { result } = renderHook(() => useMessageTree(LINEAR))
		// node b has no siblings — navigating next should stay on b
		const beforeNav = result.current.activeMessageIds.get('a')
		act(() => {
			result.current.navigateSibling(LINEAR[2], 'next') // node b
		})
		const afterNav = result.current.activeMessageIds.get('a')
		// Active child of a should still be b (or remain unchanged)
		expect(afterNav ?? LINEAR[2].id).toBe(beforeNav ?? LINEAR[2].id)
	})

	it('activeMessageIds is a Map', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		expect(result.current.activeMessageIds).toBeInstanceOf(Map)
	})

	it('navigating multiple times stabilizes on a valid sibling', () => {
		const { result } = renderHook(() => useMessageTree(BRANCHED))
		act(() => result.current.navigateSibling(BRANCHED[1], 'next')) // a → c
		act(() => result.current.navigateSibling(BRANCHED[3], 'next')) // c → a (wrap)
		const activeId = result.current.activeMessageIds.get('root')
		expect(['a', 'c']).toContain(activeId)
	})
})
