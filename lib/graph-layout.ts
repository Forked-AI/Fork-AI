import type { ChatNode } from "./graph-adapter";

export interface LayoutConfig {
	verticalSpacing: number; // Space between parent and child (300px)
	horizontalSpacing: number; // Space between siblings (250px)
	rootX: number; // Starting X position for root nodes
	rootY: number; // Starting Y position for root nodes
}

const DEFAULT_CONFIG: LayoutConfig = {
	verticalSpacing: 80,
	horizontalSpacing: 360,
	rootX: 400,
	rootY: 100,
};

/**
 * Calculate hierarchical tree layout for conversation graph
 * Positions nodes in a readable top-to-bottom flow with siblings spread horizontally
 */
export function calculateTreeLayout(
	nodes: ChatNode[],
	config: Partial<LayoutConfig> = {}
): Map<string, { x: number; y: number }> {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const positions = new Map<string, { x: number; y: number }>();

	// Build parent-to-children map
	const childrenMap = new Map<string, ChatNode[]>();
	const rootNodes: ChatNode[] = [];

	for (const node of nodes) {
		if (!node.replyTo) {
			rootNodes.push(node);
		} else {
			if (!childrenMap.has(node.replyTo)) {
				childrenMap.set(node.replyTo, []);
			}
			childrenMap.get(node.replyTo)!.push(node);
		}
	}

	// Sort children by creation time for consistent ordering
	for (const children of childrenMap.values()) {
		children.sort((a, b) => a.createdAt - b.createdAt);
	}

	// Sort root nodes by creation time
	rootNodes.sort((a, b) => a.createdAt - b.createdAt);

	// Calculate subtree width for each node (needed for centering)
	const subtreeWidths = new Map<string, number>();

	function calculateSubtreeWidth(nodeId: string): number {
		if (subtreeWidths.has(nodeId)) {
			return subtreeWidths.get(nodeId)!;
		}

		const children = childrenMap.get(nodeId) || [];
		if (children.length === 0) {
			subtreeWidths.set(nodeId, 1);
			return 1;
		}

		const totalWidth = children.reduce(
			(sum, child) => sum + calculateSubtreeWidth(child.id),
			0
		);
		subtreeWidths.set(nodeId, totalWidth);
		return totalWidth;
	}

	// Calculate widths for all nodes
	for (const node of nodes) {
		calculateSubtreeWidth(node.id);
	}

	// Position nodes recursively
	function positionNode(
		node: ChatNode,
		x: number,
		y: number,
		availableWidth: number
	): number {
		// Position current node centered in available width
		const nodeX = x + availableWidth / 2;
		positions.set(node.id, { x: nodeX, y });

		const children = childrenMap.get(node.id) || [];
		if (children.length === 0) {
			return availableWidth;
		}

		// Position children left-to-right
		let currentX = x;
		for (const child of children) {
			const childWidth =
				subtreeWidths.get(child.id)! * cfg.horizontalSpacing;
			positionNode(child, currentX, y + cfg.verticalSpacing, childWidth);
			currentX += childWidth;
		}

		return availableWidth;
	}

	// Position each root tree
	let rootX = cfg.rootX;
	for (const root of rootNodes) {
		const treeWidth = subtreeWidths.get(root.id)! * cfg.horizontalSpacing;
		positionNode(root, rootX, cfg.rootY, treeWidth);
		rootX += treeWidth + cfg.horizontalSpacing * 2; // Extra spacing between root trees
	}

	return positions;
}

/**
 * Apply layout to nodes, only updating nodes that don't have manual positions
 * @param nodes - Array of nodes to layout
 * @param config - Layout configuration
 * @returns Updated nodes with positions
 */
export function applyAutoLayout(
	nodes: ChatNode[],
	config: Partial<LayoutConfig> = {}
): ChatNode[] {
	const positions = calculateTreeLayout(nodes, config);

	return nodes.map((node) => {
		// Only auto-position nodes at (0,0) - preserve manual positions
		if (node.x !== 0 || node.y !== 0) {
			return node;
		}

		const pos = positions.get(node.id);
		if (!pos) {
			return node;
		}

		return {
			...node,
			x: pos.x,
			y: pos.y,
		};
	});
}

/**
 * Get position for a new node being created as a child of parent
 * @param parentId - ID of parent node
 * @param nodes - Current graph nodes
 * @param config - Layout configuration
 * @returns Suggested position for new node
 */
export function getNewNodePosition(
	parentId: string | null,
	nodes: ChatNode[],
	config: Partial<LayoutConfig> = {}
): { x: number; y: number } {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	if (!parentId) {
		// New root node - position to the right of existing roots
		const rootNodes = nodes.filter((n) => !n.replyTo);
		if (rootNodes.length === 0) {
			return { x: cfg.rootX, y: cfg.rootY };
		}
		const rightmost = Math.max(...rootNodes.map((n) => n.x));
		return { x: rightmost + cfg.horizontalSpacing * 2, y: cfg.rootY };
	}

	const parent = nodes.find((n) => n.id === parentId);
	if (!parent) {
		return { x: cfg.rootX, y: cfg.rootY };
	}

	// Find existing siblings
	const siblings = nodes.filter((n) => n.replyTo === parentId);

	if (siblings.length === 0) {
		// First child - position directly below parent
		return {
			x: parent.x,
			y: parent.y + cfg.verticalSpacing,
		};
	}

	// Position to the right of rightmost sibling
	const rightmost = Math.max(...siblings.map((n) => n.x));
	return {
		x: rightmost + cfg.horizontalSpacing,
		y: parent.y + cfg.verticalSpacing,
	};
}
