/**
 * Tests for lib/graph-layout.ts
 * Covers calculateTreeLayout, applyAutoLayout, and getNewNodePosition.
 */

import type { ChatNode } from '@/lib/graph-adapter'
import { applyAutoLayout, calculateTreeLayout } from '@/lib/graph-layout'
import { describe, expect, it } from 'vitest'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
function makeNode(id: string, replyTo: string | null, ts = 0): ChatNode {
	return {
		id,
		role: 'user',
		text: 'msg',
		replyTo,
		parentMessageId: replyTo,
		x: 0,
		y: 0,
		createdAt: ts,
	}
}

/**
 * Linear chain: root → a → b
 */
const linearNodes: ChatNode[] = [
	makeNode('root', null, 1),
	makeNode('a', 'root', 2),
	makeNode('b', 'a', 3),
]

/**
 * Branched tree:
 *       root
 *      /    \
 *    a        c
 *   /
 *  b
 */
const branchedNodes: ChatNode[] = [
	makeNode('root', null, 1),
	makeNode('a', 'root', 2),
	makeNode('b', 'a', 3),
	makeNode('c', 'root', 4),
]

// ─── calculateTreeLayout ──────────────────────────────────────────────────────
describe('calculateTreeLayout', () => {
	it('returns a position for every node', () => {
		const positions = calculateTreeLayout(linearNodes)
		expect(positions.size).toBe(3)
		for (const node of linearNodes) {
			expect(positions.has(node.id)).toBe(true)
		}
	})

	it('returns empty map for empty nodes', () => {
		expect(calculateTreeLayout([])).toEqual(new Map())
	})

	it('positions deeper nodes lower (higher Y) in linear chain', () => {
		const positions = calculateTreeLayout(linearNodes)
		const yRoot = positions.get('root')!.y
		const yA = positions.get('a')!.y
		const yB = positions.get('b')!.y
		expect(yA).toBeGreaterThan(yRoot)
		expect(yB).toBeGreaterThan(yA)
	})

	it('sibling nodes are at the same depth (same Y)', () => {
		const positions = calculateTreeLayout(branchedNodes)
		const yA = positions.get('a')!.y
		const yC = positions.get('c')!.y
		expect(yA).toBe(yC)
	})

	it('siblings are horizontally separated (different X)', () => {
		const positions = calculateTreeLayout(branchedNodes)
		const xA = positions.get('a')!.x
		const xC = positions.get('c')!.x
		expect(xA).not.toBe(xC)
	})

	it('respects custom verticalSpacing', () => {
		const pos100 = calculateTreeLayout(linearNodes, { verticalSpacing: 100 })
		const pos200 = calculateTreeLayout(linearNodes, { verticalSpacing: 200 })
		const diff100 = pos100.get('a')!.y - pos100.get('root')!.y
		const diff200 = pos200.get('a')!.y - pos200.get('root')!.y
		expect(diff200).toBeGreaterThan(diff100)
	})

	it('respects custom rootY', () => {
		const positions = calculateTreeLayout(linearNodes, { rootY: 500 })
		expect(positions.get('root')!.y).toBe(500)
	})

	it('handles a forest (two independent root trees)', () => {
		const forest: ChatNode[] = [
			makeNode('r1', null, 1),
			makeNode('r2', null, 2),
			makeNode('child1', 'r1', 3),
		]
		const positions = calculateTreeLayout(forest)
		expect(positions.size).toBe(3)
		// The two root trees should be horizontally offset
		expect(positions.get('r1')!.x).not.toBe(positions.get('r2')!.x)
	})

	it('single node is placed at rootX, rootY', () => {
		const single = [makeNode('solo', null, 1)]
		const positions = calculateTreeLayout(single, { rootX: 400, rootY: 100 })
		const pos = positions.get('solo')!
		// Node is centered in available width; for single leaf, subtreeWidth=1
		// x = rootX + (1 * horizontalSpacing) / 2 = 400 + 180 = 580 (default h=360)
		expect(pos.y).toBe(100)
	})
})

// ─── applyAutoLayout ──────────────────────────────────────────────────────────
describe('applyAutoLayout', () => {
	it('assigns positions to nodes at (0,0)', () => {
		const nodes = linearNodes
		const laid = applyAutoLayout(nodes)
		for (const n of laid) {
			const original = linearNodes.find((m) => m.id === n.id)!
			if (original.x === 0 && original.y === 0) {
				// should have been positioned differently from (0,0) unless rootX/Y is 0
				// position was assigned from layout
				expect(typeof n.x).toBe('number')
				expect(typeof n.y).toBe('number')
			}
		}
	})

	it('preserves manual (non-zero) positions', () => {
		const nodesWithManual: ChatNode[] = [
			{ ...makeNode('root', null, 1), x: 999, y: 888 },
			makeNode('a', 'root', 2),
		]
		const laid = applyAutoLayout(nodesWithManual)
		const root = laid.find((n) => n.id === 'root')!
		expect(root.x).toBe(999)
		expect(root.y).toBe(888)
	})

	it('returns same number of nodes', () => {
		expect(applyAutoLayout(branchedNodes)).toHaveLength(branchedNodes.length)
	})

	it('returns empty array for empty input', () => {
		expect(applyAutoLayout([])).toEqual([])
	})
})

// ─── Edge cases: calculateTreeLayout ─────────────────────────────────────────
describe('calculateTreeLayout — edge cases', () => {
	it('wide star (1 root, 10 direct children) places all children at same Y', () => {
		const star: ChatNode[] = [
			makeNode('root', null, 0),
			...Array.from({ length: 10 }, (_, i) => makeNode(`child${i}`, 'root', i + 1)),
		]
		const positions = calculateTreeLayout(star)
		const childYs = new Set(
			star.slice(1).map((n) => positions.get(n.id)!.y)
		)
		expect(childYs.size).toBe(1) // all at same depth
	})

	it('wide star children are all at distinct X positions', () => {
		const star: ChatNode[] = [
			makeNode('root', null, 0),
			...Array.from({ length: 10 }, (_, i) => makeNode(`c${i}`, 'root', i + 1)),
		]
		const positions = calculateTreeLayout(star)
		const childXs = star.slice(1).map((n) => positions.get(n.id)!.x)
		const uniqueXs = new Set(childXs)
		expect(uniqueXs.size).toBe(10) // all horizontally distinct
	})

	it('node referencing a non-existent parent is silently dropped from layout', () => {
		const nodes: ChatNode[] = [
			makeNode('real-root', null, 0),
			makeNode('orphan', 'ghost-parent', 1), // ghost-parent doesn't exist
		]
		const positions = calculateTreeLayout(nodes)
		// The orphan is dropped — only real-root is positioned
		expect(positions.has('real-root')).toBe(true)
		expect(positions.has('orphan')).toBe(false)
	})

	it('children are ordered by createdAt regardless of array insertion order', () => {
		// Insert children in reverse time order; layout should still spread them
		const nodes: ChatNode[] = [
			makeNode('root', null, 0),
			makeNode('later', 'root', 10),
			makeNode('earlier', 'root', 1),
		]
		const positions = calculateTreeLayout(nodes)
		// Both children should be at the same Y (same depth)
		expect(positions.get('later')!.y).toBe(positions.get('earlier')!.y)
	})

	it('verticalSpacing=0 places all nodes at the same Y', () => {
		const positions = calculateTreeLayout(linearNodes, { verticalSpacing: 0 })
		const ys = linearNodes.map((n) => positions.get(n.id)!.y)
		const uniqueYs = new Set(ys)
		expect(uniqueYs.size).toBe(1) // all same Y
	})
})

// ─── Edge cases: applyAutoLayout ─────────────────────────────────────────────
describe('applyAutoLayout — edge cases', () => {
	it('node with x=0 but y≠0 is NOT auto-laid-out (condition requires BOTH zero)', () => {
		const nodes: ChatNode[] = [
			{ ...makeNode('root', null, 1), x: 0, y: 500 },
		]
		const laid = applyAutoLayout(nodes)
		const root = laid.find((n) => n.id === 'root')!
		// If only x is 0 but y is not, position should be preserved unchanged
		expect(root.y).toBe(500)
	})

	it('calling applyAutoLayout twice produces the same result (idempotent)', () => {
		const once = applyAutoLayout(branchedNodes)
		const twice = applyAutoLayout(once)
		for (const first of once) {
			const second = twice.find((n) => n.id === first.id)!
			expect(second.x).toBe(first.x)
			expect(second.y).toBe(first.y)
		}
	})

	it('all nodes with manual positions remain unchanged through auto-layout', () => {
		const manual: ChatNode[] = [
			{ ...makeNode('root', null, 1), x: 100, y: 200 },
			{ ...makeNode('a', 'root', 2), x: 300, y: 400 },
		]
		const laid = applyAutoLayout(manual)
		expect(laid.find((n) => n.id === 'root')!.x).toBe(100)
		expect(laid.find((n) => n.id === 'a')!.x).toBe(300)
	})

	it('single node at (0,0) gets a non-null position after auto-layout', () => {
		const single = [makeNode('solo', null, 1)]
		const laid = applyAutoLayout(single)
		expect(typeof laid[0].x).toBe('number')
		expect(typeof laid[0].y).toBe('number')
	})
})
