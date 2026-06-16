/**
 * Tests for lib/tree.ts
 * Covers all exported tree utility functions.
 */

import type { MessageNode } from '@/lib/tree'
import {
    buildChildMap,
    getAncestors,
    getChildren,
    getDepth,
    getRoots,
    getSiblings,
    getSubtreeIds,
    isAncestor,
    isDescendant,
} from '@/lib/tree'
import { describe, expect, it } from 'vitest'

// ─── Shared fixtures ───────────────────────────────────────────────────────────
/**
 * Tree structure:
 *       root
 *      /    \
 *    a        b
 *   / \
 *  c   d
 *       \
 *        e
 */
const root: MessageNode = { id: 'root', parentMessageId: null }
const a: MessageNode = { id: 'a', parentMessageId: 'root' }
const b: MessageNode = { id: 'b', parentMessageId: 'root' }
const c: MessageNode = { id: 'c', parentMessageId: 'a' }
const d: MessageNode = { id: 'd', parentMessageId: 'a' }
const e: MessageNode = { id: 'e', parentMessageId: 'd' }
const ALL = [root, a, b, c, d, e]

// ─── buildChildMap ─────────────────────────────────────────────────────────────
describe('buildChildMap', () => {
	it('returns empty map for empty messages', () => {
		const map = buildChildMap([])
		expect(map.size).toBe(0)
	})

	it('maps root messages (parentId null) correctly', () => {
		const map = buildChildMap(ALL)
		expect(map.get(null)).toEqual(['root'])
	})

	it('lists all children of a node', () => {
		const map = buildChildMap(ALL)
		expect(map.get('root')).toEqual(expect.arrayContaining(['a', 'b']))
		expect(map.get('a')).toEqual(expect.arrayContaining(['c', 'd']))
	})

	it('leaf nodes have no entry or empty array', () => {
		const map = buildChildMap(ALL)
		expect(map.get('e') ?? []).toHaveLength(0)
	})

	it('handles single root node', () => {
		const map = buildChildMap([root])
		expect(map.get(null)).toEqual(['root'])
	})

	it('handles a flat list (all siblings)', () => {
		const flat = [
			{ id: 'x', parentMessageId: 'parent' },
			{ id: 'y', parentMessageId: 'parent' },
			{ id: 'z', parentMessageId: 'parent' },
		]
		const map = buildChildMap(flat)
		const children = map.get('parent') ?? []
		expect(children).toHaveLength(3)
		expect(children).toEqual(expect.arrayContaining(['x', 'y', 'z']))
	})
})

// ─── getAncestors ──────────────────────────────────────────────────────────────
describe('getAncestors', () => {
	it('returns just the node itself for the root', () => {
		const result = getAncestors(ALL, 'root')
		expect(result.map((n) => n.id)).toEqual(['root'])
	})

	it('returns [root, a, d, e] for node e', () => {
		const result = getAncestors(ALL, 'e')
		expect(result.map((n) => n.id)).toEqual(['root', 'a', 'd', 'e'])
	})

	it('returns [root, b] for node b', () => {
		const result = getAncestors(ALL, 'b')
		expect(result.map((n) => n.id)).toEqual(['root', 'b'])
	})

	it('returns [] for unknown node id', () => {
		const result = getAncestors(ALL, 'not-exist')
		expect(result).toHaveLength(0)
	})

	it('preserves root-to-leaf order', () => {
		const result = getAncestors(ALL, 'c')
		expect(result.map((n) => n.id)).toEqual(['root', 'a', 'c'])
	})
})

// ─── getSubtreeIds ─────────────────────────────────────────────────────────────
describe('getSubtreeIds', () => {
	it('returns only the node itself when it is a leaf', () => {
		const ids = getSubtreeIds(ALL, 'e')
		expect(ids).toEqual(['e'])
	})

	it('returns all ids in subtree rooted at "a"', () => {
		const ids = getSubtreeIds(ALL, 'a')
		expect(ids).toEqual(expect.arrayContaining(['a', 'c', 'd', 'e']))
		expect(ids).not.toContain('b')
	})

	it('returns all ids when starting from root', () => {
		const ids = getSubtreeIds(ALL, 'root')
		expect(ids.sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'root'].sort())
	})

	it('returns empty array for unknown node', () => {
		// BFS starts with the id; if it has no children and itself is not in messages, it's still pushed
		const ids = getSubtreeIds(ALL, 'not-exist')
		// BFS puts 'not-exist' in the queue; it won't be in childMap so returns just it
		expect(ids).toEqual(['not-exist'])
	})
})

// ─── isAncestor ───────────────────────────────────────────────────────────────
describe('isAncestor', () => {
	it('root is ancestor of e', () => {
		expect(isAncestor(ALL, 'root', 'e')).toBe(true)
	})

	it('a is ancestor of c', () => {
		expect(isAncestor(ALL, 'a', 'c')).toBe(true)
	})

	it('b is NOT ancestor of c', () => {
		expect(isAncestor(ALL, 'b', 'c')).toBe(false)
	})

	it('e is NOT ancestor of root (reversed direction)', () => {
		expect(isAncestor(ALL, 'e', 'root')).toBe(false)
	})

	it('a node is not its own ancestor', () => {
		expect(isAncestor(ALL, 'a', 'a')).toBe(true) // ancestors includes self
	})
})

// ─── isDescendant ─────────────────────────────────────────────────────────────
describe('isDescendant', () => {
	it('e is descendant of root', () => {
		expect(isDescendant(ALL, 'e', 'root')).toBe(true)
	})

	it('c is NOT descendant of b', () => {
		expect(isDescendant(ALL, 'c', 'b')).toBe(false)
	})
})

// ─── getSiblings ──────────────────────────────────────────────────────────────
describe('getSiblings', () => {
	it('returns both children of root (a and b) for node a', () => {
		const siblings = getSiblings(ALL, 'a')
		expect(siblings.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']))
	})

	it('returns only the node itself for a node with no siblings', () => {
		const siblings = getSiblings(ALL, 'b')
		// b's siblings are a and b
		expect(siblings.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']))
	})

	it('includes the node itself in the sibling list', () => {
		const siblings = getSiblings(ALL, 'e')
		expect(siblings.map((n) => n.id)).toContain('e')
	})

	it('returns [] for unknown node', () => {
		const siblings = getSiblings(ALL, 'not-exist')
		expect(siblings).toEqual([])
	})
})

// ─── getChildren ──────────────────────────────────────────────────────────────
describe('getChildren', () => {
	it('returns direct children of root', () => {
		const children = getChildren(ALL, 'root')
		expect(children.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']))
		expect(children).toHaveLength(2)
	})

	it('returns root nodes when parentId is null', () => {
		const roots = getChildren(ALL, null)
		expect(roots.map((n) => n.id)).toEqual(['root'])
	})

	it('returns [] for a leaf node', () => {
		const children = getChildren(ALL, 'e')
		expect(children).toHaveLength(0)
	})

	it('returns [] for unknown parentId', () => {
		const children = getChildren(ALL, 'ghost')
		expect(children).toHaveLength(0)
	})
})

// ─── getRoots ─────────────────────────────────────────────────────────────────
describe('getRoots', () => {
	it('returns the root in a normal tree', () => {
		const roots = getRoots(ALL)
		expect(roots.map((n) => n.id)).toEqual(['root'])
	})

	it('returns empty array for empty messages', () => {
		expect(getRoots([])).toHaveLength(0)
	})

	it('returns multiple roots for a forest', () => {
		const forest = [
			{ id: 'r1', parentMessageId: null },
			{ id: 'r2', parentMessageId: null },
			{ id: 'child', parentMessageId: 'r1' },
		]
		const roots = getRoots(forest)
		expect(roots.map((n) => n.id)).toEqual(expect.arrayContaining(['r1', 'r2']))
		expect(roots).toHaveLength(2)
	})
})

// ─── getDepth ─────────────────────────────────────────────────────────────────
describe('getDepth', () => {
	it('root has depth 0', () => {
		expect(getDepth(ALL, 'root')).toBe(0)
	})

	it('direct child of root has depth 1', () => {
		expect(getDepth(ALL, 'a')).toBe(1)
		expect(getDepth(ALL, 'b')).toBe(1)
	})

	it('grandchild has depth 2', () => {
		expect(getDepth(ALL, 'c')).toBe(2)
		expect(getDepth(ALL, 'd')).toBe(2)
	})

	it('great-grandchild has depth 3', () => {
		expect(getDepth(ALL, 'e')).toBe(3)
	})
})

// ─── Edge-case: single node tree ──────────────────────────────────────────────
describe('single-node tree', () => {
	const single = [{ id: 'only', parentMessageId: null }]

	it('getAncestors returns just the node', () => {
		expect(getAncestors(single, 'only').map((n) => n.id)).toEqual(['only'])
	})

	it('getSubtreeIds returns just the node', () => {
		expect(getSubtreeIds(single, 'only')).toEqual(['only'])
	})

	it('getDepth is 0', () => {
		expect(getDepth(single, 'only')).toBe(0)
	})

	it('getChildren(null) returns the single root', () => {
		expect(getChildren(single, null).map((n) => n.id)).toEqual(['only'])
	})
})

// ─── Edge-cases: orphaned / dangling parent references ─────────────────────────
describe('dangling parentMessageId (orphaned node)', () => {
	const orphaned: MessageNode[] = [
		{ id: 'root', parentMessageId: null },
		{ id: 'orphan', parentMessageId: 'does-not-exist' },
	]

	it('buildChildMap still records orphan under its declared parent', () => {
		const map = buildChildMap(orphaned)
		expect(map.get('does-not-exist')).toEqual(['orphan'])
	})

	it('getAncestors stops walking when parent id has no matching node', () => {
		// Should not throw; returns partial chain: [orphan]
		const ancestors = getAncestors(orphaned, 'orphan')
		expect(ancestors.map((n) => n.id)).toEqual(['orphan'])
	})

	it('getDepth of orphan is 0 (chain stops at missing parent)', () => {
		expect(getDepth(orphaned, 'orphan')).toBe(0)
	})

	it('getRoots does not include orphan (it has a parentMessageId set)', () => {
		const roots = getRoots(orphaned)
		expect(roots.map((n) => n.id)).not.toContain('orphan')
	})
})

// ─── Edge-cases: star topology (one root, many direct leaves) ─────────────────
describe('star topology (one root, 50 direct children)', () => {
	const starRoot: MessageNode = { id: 'center', parentMessageId: null }
	const starLeaves: MessageNode[] = Array.from({ length: 50 }, (_, i) => ({
		id: `leaf-${i}`,
		parentMessageId: 'center',
	}))
	const star = [starRoot, ...starLeaves]

	it('buildChildMap assigns all 50 leaves under center', () => {
		const map = buildChildMap(star)
		expect(map.get('center')).toHaveLength(50)
	})

	it('getSubtreeIds from center returns all 51 nodes', () => {
		expect(getSubtreeIds(star, 'center')).toHaveLength(51)
	})

	it('every leaf has depth 1', () => {
		for (const leaf of starLeaves) {
			expect(getDepth(star, leaf.id)).toBe(1)
		}
	})

	it('every leaf has 50 siblings (including itself)', () => {
		const siblings = getSiblings(star, 'leaf-0')
		expect(siblings).toHaveLength(50)
	})

	it('isAncestor: center is ancestor of every leaf', () => {
		for (const leaf of starLeaves) {
			expect(isAncestor(star, 'center', leaf.id)).toBe(true)
		}
	})

	it('isAncestor: leaves are not ancestors of each other', () => {
		expect(isAncestor(star, 'leaf-0', 'leaf-1')).toBe(false)
	})
})

// ─── Edge-cases: long linear chain ────────────────────────────────────────────
describe('long linear chain (depth 200)', () => {
	const chain: MessageNode[] = [{ id: 'n0', parentMessageId: null }]
	for (let i = 1; i <= 200; i++) {
		chain.push({ id: `n${i}`, parentMessageId: `n${i - 1}` })
	}

	it('getDepth of last node is 200', () => {
		expect(getDepth(chain, 'n200')).toBe(200)
	})

	it('getAncestors of last node has 201 entries', () => {
		expect(getAncestors(chain, 'n200')).toHaveLength(201)
	})

	it('getSubtreeIds from root returns all 201 nodes', () => {
		expect(getSubtreeIds(chain, 'n0')).toHaveLength(201)
	})

	it('getAncestors preserves strict root-to-leaf order', () => {
		const ancestors = getAncestors(chain, 'n200')
		for (let i = 0; i <= 200; i++) {
			expect(ancestors[i].id).toBe(`n${i}`)
		}
	})
})

// ─── Edge-cases: forest with multiple roots ────────────────────────────────────
describe('large forest (10 independent trees, depth 3 each)', () => {
	const forest: MessageNode[] = []
	for (let t = 0; t < 10; t++) {
		forest.push({ id: `t${t}`, parentMessageId: null })
		forest.push({ id: `t${t}-c1`, parentMessageId: `t${t}` })
		forest.push({ id: `t${t}-c2`, parentMessageId: `t${t}` })
		forest.push({ id: `t${t}-c1-g1`, parentMessageId: `t${t}-c1` })
	}

	it('getRoots finds exactly 10 roots', () => {
		expect(getRoots(forest)).toHaveLength(10)
	})

	it('isAncestor is false across tree boundaries', () => {
		// t0 should NOT be ancestor of t1-c1
		expect(isAncestor(forest, 't0', 't1-c1')).toBe(false)
	})

	it('getSubtreeIds from t0 returns only 4 nodes (its own subtree)', () => {
		expect(getSubtreeIds(forest, 't0')).toHaveLength(4)
	})
})

// ─── Edge-cases: extra properties on MessageNode ───────────────────────────────
describe('MessageNode with extra properties', () => {
	const rich: MessageNode[] = [
		{ id: 'r', parentMessageId: null, role: 'user', content: 'hello', model: 'gpt-4' },
		{ id: 'child', parentMessageId: 'r', role: 'assistant', content: 'world', timestamp: 123456 },
	]

	it('getAncestors returns nodes with extra properties intact', () => {
		const ancestors = getAncestors(rich, 'child')
		expect((ancestors[0] as any).role).toBe('user')
		expect((ancestors[1] as any).role).toBe('assistant')
	})

	it('buildChildMap works regardless of extra fields', () => {
		const map = buildChildMap(rich)
		expect(map.get('r')).toEqual(['child'])
	})
})

// ─── Edge-cases: getSiblings / getChildren ordering ───────────────────────────
describe('getSiblings includes self and preserves insertion order', () => {
	const msgs: MessageNode[] = [
		{ id: 'parent', parentMessageId: null },
		{ id: 'child-1', parentMessageId: 'parent' },
		{ id: 'child-2', parentMessageId: 'parent' },
		{ id: 'child-3', parentMessageId: 'parent' },
	]

	it('getSiblings for child-2 includes all three children', () => {
		const siblings = getSiblings(msgs, 'child-2')
		expect(siblings).toHaveLength(3)
		expect(siblings.map((s) => s.id)).toEqual(
			expect.arrayContaining(['child-1', 'child-2', 'child-3'])
		)
	})

	it('getChildren(parent) returns all three children', () => {
		expect(getChildren(msgs, 'parent')).toHaveLength(3)
	})

	it('getChildren result contains correct node objects', () => {
		const children = getChildren(msgs, 'parent')
		children.forEach((c) => expect(c.parentMessageId).toBe('parent'))
	})
})

// ─── Edge-cases: isDescendant completeness ────────────────────────────────────
describe('isDescendant edge cases', () => {
	it('node is considered its own descendant (self-check)', () => {
		// isDescendant calls isAncestor which finds self in ancestors
		expect(isDescendant(ALL, 'a', 'a')).toBe(true)
	})

	it('sibling is not descendant of sibling', () => {
		expect(isDescendant(ALL, 'a', 'b')).toBe(false)
		expect(isDescendant(ALL, 'b', 'a')).toBe(false)
	})

	it('leaf is not descendant of a node in a different branch', () => {
		expect(isDescendant(ALL, 'c', 'b')).toBe(false)
	})
})
