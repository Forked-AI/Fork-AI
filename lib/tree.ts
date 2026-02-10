/**
 * Tree utility functions for managing message branching structure
 * Based on parent-pointer tree model where each node has a parentMessageId
 */

export interface MessageNode {
	id: string;
	parentMessageId: string | null;
	[key: string]: any; // Allow other message properties
}

/**
 * Build a lookup map from parent ID to array of child IDs
 * Useful for efficiently finding all children of a given node
 *
 * @param messages - Array of message nodes
 * @returns Map where key is parentId (or null for roots) and value is array of child IDs
 */
export function buildChildMap(
	messages: MessageNode[]
): Map<string | null, string[]> {
	const childMap = new Map<string | null, string[]>();

	for (const message of messages) {
		const parentId = message.parentMessageId;
		if (!childMap.has(parentId)) {
			childMap.set(parentId, []);
		}
		childMap.get(parentId)!.push(message.id);
	}

	return childMap;
}

/**
 * Get the ancestor chain from root to the given node
 * Returns nodes in order: [root, ..., parent, node]
 * This is useful for building conversation context for AI
 *
 * @param messages - Array of all messages
 * @param nodeId - The target node ID
 * @returns Array of ancestor nodes from root to target (inclusive)
 */
export function getAncestors(
	messages: MessageNode[],
	nodeId: string
): MessageNode[] {
	const messageMap = new Map(messages.map((m) => [m.id, m]));
	const ancestors: MessageNode[] = [];

	let currentId: string | null = nodeId;

	// Walk up the tree from node to root
	while (currentId !== null) {
		const node = messageMap.get(currentId);
		if (!node) {
			// Node not found, return what we have
			break;
		}
		ancestors.unshift(node); // Add to front to maintain root->leaf order
		currentId = node.parentMessageId;
	}

	return ancestors;
}

/**
 * Get all descendant node IDs in a subtree (BFS traversal)
 * Useful for cascade delete operations
 *
 * @param messages - Array of all messages
 * @param nodeId - The root of the subtree
 * @returns Array of all node IDs in the subtree (including root)
 */
export function getSubtreeIds(
	messages: MessageNode[],
	nodeId: string
): string[] {
	const childMap = buildChildMap(messages);
	const subtreeIds: string[] = [];
	const queue: string[] = [nodeId];

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		subtreeIds.push(currentId);

		const children = childMap.get(currentId) || [];
		queue.push(...children);
	}

	return subtreeIds;
}

/**
 * Check if ancestorId is an ancestor of descendantId
 * Used to prevent circular references when reparenting
 *
 * @param messages - Array of all messages
 * @param ancestorId - Potential ancestor node ID
 * @param descendantId - Potential descendant node ID
 * @returns true if ancestorId is an ancestor of descendantId
 */
export function isAncestor(
	messages: MessageNode[],
	ancestorId: string,
	descendantId: string
): boolean {
	const ancestors = getAncestors(messages, descendantId);
	return ancestors.some((node) => node.id === ancestorId);
}

/**
 * Check if a node is a descendant of another node
 * (Alias for isAncestor with swapped parameters for clarity)
 */
export function isDescendant(
	messages: MessageNode[],
	descendantId: string,
	ancestorId: string
): boolean {
	return isAncestor(messages, ancestorId, descendantId);
}

/**
 * Get all sibling messages (same parent)
 *
 * @param messages - Array of all messages
 * @param messageId - The message ID to find siblings for
 * @returns Array of sibling messages (including the message itself)
 */
export function getSiblings(
	messages: MessageNode[],
	messageId: string
): MessageNode[] {
	const messageMap = new Map(messages.map((m) => [m.id, m]));
	const message = messageMap.get(messageId);

	if (!message) {
		return [];
	}

	const parentId = message.parentMessageId;
	return messages.filter((m) => m.parentMessageId === parentId);
}

/**
 * Get direct children of a node
 *
 * @param messages - Array of all messages
 * @param parentId - The parent node ID (or null for roots)
 * @returns Array of direct children
 */
export function getChildren(
	messages: MessageNode[],
	parentId: string | null
): MessageNode[] {
	return messages.filter((m) => m.parentMessageId === parentId);
}

/**
 * Get root nodes (messages with no parent)
 *
 * @param messages - Array of all messages
 * @returns Array of root messages
 */
export function getRoots(messages: MessageNode[]): MessageNode[] {
	return messages.filter((m) => m.parentMessageId === null);
}

/**
 * Count the depth of a node (distance from root)
 * Root nodes have depth 0
 *
 * @param messages - Array of all messages
 * @param nodeId - The node to measure depth for
 * @returns Depth (0 for root, 1 for direct child of root, etc.)
 */
export function getDepth(messages: MessageNode[], nodeId: string): number {
	const ancestors = getAncestors(messages, nodeId);
	return ancestors.length - 1; // -1 because ancestors includes the node itself
}
