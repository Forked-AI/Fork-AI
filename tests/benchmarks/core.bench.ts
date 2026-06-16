/**
 * Benchmarks for Fork.AI core utilities
 * Run with: pnpm vitest bench
 *
 * These benchmarks measure throughput of CPU-bound, non-I/O operations that
 * are called in hot paths (graph rendering, tree traversal, color processing).
 */

import type { Message } from '@/hooks/use-chat'
import {
    getContrastRatio,
    hexToRgb,
    hslToRgb,
    isWCAGCompliant,
    rgbToHex,
    rgbToHsl,
} from '@/lib/color-utils'
import { exportAsJSON, exportAsMarkdown, exportAsText } from '@/lib/export-utils'
import type { ChatNode } from '@/lib/graph-adapter'
import { messageToGraphNode, messagesToChatGraph } from '@/lib/graph-adapter'
import { applyAutoLayout, calculateTreeLayout } from '@/lib/graph-layout'
import type { MessageNode } from '@/lib/tree'
import {
    buildChildMap,
    getAncestors,
    getDepth,
    getSiblings,
    getSubtreeIds,
} from '@/lib/tree'
import { bench, describe } from 'vitest'

// ─── Data generators ──────────────────────────────────────────────────────────

/** Build a linear chain of N message nodes */
function buildLinearChain(n: number): MessageNode[] {
	const nodes: MessageNode[] = [{ id: 'n0', parentMessageId: null }]
	for (let i = 1; i < n; i++) {
		nodes.push({ id: `n${i}`, parentMessageId: `n${i - 1}` })
	}
	return nodes
}

/** Build a balanced binary tree of depth D */
function buildBinaryTree(depth: number): MessageNode[] {
	const nodes: MessageNode[] = []
	function recurse(id: string, parentId: string | null, currentDepth: number) {
		nodes.push({ id, parentMessageId: parentId })
		if (currentDepth >= depth) return
		recurse(`${id}L`, id, currentDepth + 1)
		recurse(`${id}R`, id, currentDepth + 1)
	}
	recurse('root', null, 0)
	return nodes
}

/** Build a ChatNode array from MessageNode array (for graph-layout benchmarks) */
function buildChatNodes(messageNodes: MessageNode[]): ChatNode[] {
	return messageNodes.map((n) => ({
		id: n.id,
		role: 'assistant',
		text: 'Lorem ipsum dolor sit amet',
		replyTo: n.parentMessageId,
		parentMessageId: n.parentMessageId,
		x: 0,
		y: 0,
		createdAt: 0,
	}))
}

/** Build Message array for export benchmarks */
function buildMessages(n: number): Message[] {
	const messages: Message[] = []
	for (let i = 0; i < n; i++) {
		messages.push({
			id: `msg-${i}`,
			role: i % 2 === 0 ? 'user' : 'assistant',
			content: `Message content number ${i}. `.repeat(10),
			model: i % 2 === 1 ? 'mistral-large' : undefined,
			createdAt: new Date(Date.now() + i * 1000),
			parentMessageId: i === 0 ? null : `msg-${i - 1}`,
		})
	}
	return messages
}

// ─── Pre-computed fixtures ────────────────────────────────────────────────────
const CHAIN_100 = buildLinearChain(100)
const CHAIN_1000 = buildLinearChain(1000)
const CHAIN_5000 = buildLinearChain(5000)
const BINARY_D8 = buildBinaryTree(8) // 2^9 - 1 = 511 nodes
const BINARY_D10 = buildBinaryTree(10) // 2^11 - 1 = 2047 nodes

const CHAT_100 = buildChatNodes(CHAIN_100)
const CHAT_511 = buildChatNodes(BINARY_D8)

const MESSAGES_50 = buildMessages(50)
const MESSAGES_200 = buildMessages(200)

// ─── Tree benchmarks ──────────────────────────────────────────────────────────
describe('tree — buildChildMap', () => {
	bench('100-node linear chain', () => {
		buildChildMap(CHAIN_100)
	})

	bench('1000-node linear chain', () => {
		buildChildMap(CHAIN_1000)
	})

	bench('5000-node linear chain', () => {
		buildChildMap(CHAIN_5000)
	})

	bench('511-node binary tree (depth 8)', () => {
		buildChildMap(BINARY_D8)
	})

	bench('2047-node binary tree (depth 10)', () => {
		buildChildMap(BINARY_D10)
	})
})

describe('tree — getAncestors', () => {
	bench('leaf of 100-node chain (depth 99)', () => {
		getAncestors(CHAIN_100, 'n99')
	})

	bench('leaf of 1000-node chain (depth 999)', () => {
		getAncestors(CHAIN_1000, 'n999')
	})

	bench('leaf of 5000-node chain (depth 4999)', () => {
		getAncestors(CHAIN_5000, 'n4999')
	})

	bench('deepest leaf of binary tree depth 8', () => {
		// Rightmost leaf: rootRRRRRRRR
		const leafId = 'root' + 'R'.repeat(8)
		getAncestors(BINARY_D8, leafId)
	})
})

describe('tree — getSubtreeIds', () => {
	bench('entire 100-node chain from root', () => {
		getSubtreeIds(CHAIN_100, 'n0')
	})

	bench('entire 1000-node chain from root', () => {
		getSubtreeIds(CHAIN_1000, 'n0')
	})

	bench('entire 511-node binary tree from root', () => {
		getSubtreeIds(BINARY_D8, 'root')
	})
})

describe('tree — getDepth', () => {
	bench('depth of leaf in 100-node chain', () => {
		getDepth(CHAIN_100, 'n99')
	})

	bench('depth of leaf in 1000-node chain', () => {
		getDepth(CHAIN_1000, 'n999')
	})
})

describe('tree — getSiblings', () => {
	bench('getSiblings in binary tree (each node has 2 siblings max)', () => {
		getSiblings(BINARY_D8, 'rootR')
	})

	bench('getSiblings in 100-node chain (single sibling)', () => {
		getSiblings(CHAIN_100, 'n50')
	})
})

// ─── Color utility benchmarks ─────────────────────────────────────────────────
describe('color-utils — conversions', () => {
	bench('hexToRgb × 1000', () => {
		for (let i = 0; i < 1000; i++) {
			hexToRgb('#8b5cf6')
		}
	})

	bench('rgbToHex × 1000', () => {
		for (let i = 0; i < 1000; i++) {
			rgbToHex({ r: 139, g: 92, b: 246 })
		}
	})

	bench('rgbToHsl × 1000', () => {
		for (let i = 0; i < 1000; i++) {
			rgbToHsl({ r: 139, g: 92, b: 246 })
		}
	})

	bench('hslToRgb × 1000', () => {
		for (let i = 0; i < 1000; i++) {
			hslToRgb({ h: 262, s: 84, l: 66 })
		}
	})
})

describe('color-utils — contrast', () => {
	bench('getContrastRatio × 1000', () => {
		for (let i = 0; i < 1000; i++) {
			getContrastRatio('#ffffff', '#000000')
		}
	})

	bench('isWCAGCompliant (AA) × 1000', () => {
		for (let i = 0; i < 1000; i++) {
			isWCAGCompliant('#000000', '#ffffff', 'AA')
		}
	})

	bench('isWCAGCompliant (AAA) × 1000', () => {
		for (let i = 0; i < 1000; i++) {
			isWCAGCompliant('#000000', '#ffffff', 'AAA')
		}
	})
})

// ─── Graph layout benchmarks ──────────────────────────────────────────────────
describe('graph-layout — calculateTreeLayout', () => {
	bench('100-node linear chain', () => {
		calculateTreeLayout(CHAT_100)
	})

	bench('511-node binary tree (depth 8)', () => {
		calculateTreeLayout(CHAT_511)
	})
})

describe('graph-layout — applyAutoLayout', () => {
	bench('100 nodes', () => {
		applyAutoLayout(CHAT_100)
	})

	bench('511 nodes (binary tree)', () => {
		applyAutoLayout(CHAT_511)
	})
})

// ─── graph-adapter benchmark ──────────────────────────────────────────────────
describe('graph-adapter — messageToGraphNode', () => {
	const rawMsg = {
		id: 'bench-1',
		role: 'user',
		content: 'Hello world',
		parentMessageId: null as string | null,
		positionX: null as number | null,
		positionY: null as number | null,
		createdAt: new Date(),
		isRootNode: false,
		rootNodeName: null as string | null,
		model: null as string | null,
		isError: false,
	}

	bench('messageToGraphNode × 10000', () => {
		for (let i = 0; i < 10000; i++) {
			messageToGraphNode(rawMsg)
		}
	})
})

describe('graph-adapter — messagesToChatGraph', () => {
	const rawMessages = Array.from({ length: 200 }, (_, i) => ({
		id: `m${i}`,
		role: i % 2 === 0 ? 'user' : 'assistant',
		content: `Content ${i}`,
		parentMessageId: i === 0 ? null : `m${i - 1}`,
		positionX: null as number | null,
		positionY: null as number | null,
		createdAt: new Date(Date.now() + i * 1000),
		isRootNode: i === 0,
		rootNodeName: null as string | null,
		model: i % 2 === 1 ? 'mistral-large' : null,
		isError: false,
	}))

	bench('200 messages', () => {
		messagesToChatGraph('conv-bench', rawMessages)
	})
})

// ─── Export benchmarks ────────────────────────────────────────────────────────
describe('export-utils', () => {
	bench('exportAsMarkdown — 50 messages', () => {
		exportAsMarkdown(MESSAGES_50)
	})

	bench('exportAsMarkdown — 200 messages', () => {
		exportAsMarkdown(MESSAGES_200)
	})

	bench('exportAsJSON — 50 messages', () => {
		exportAsJSON(MESSAGES_50)
	})

	bench('exportAsJSON — 200 messages', () => {
		exportAsJSON(MESSAGES_200)
	})

	bench('exportAsText — 50 messages', () => {
		exportAsText(MESSAGES_50)
	})

	bench('exportAsText — 200 messages', () => {
		exportAsText(MESSAGES_200)
	})
})
