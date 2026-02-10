/**
 * Graph API Client
 * Replaces dragdropui's localStorage with REST API calls
 */

import type { ChatGraph, GraphNode } from "./graph-adapter";

const API_BASE = "/api";

/**
 * Fetch conversation graph data
 */
export async function fetchGraph(conversationId: string): Promise<ChatGraph> {
	const response = await fetch(
		`${API_BASE}/conversations/${conversationId}/graph`
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch graph: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Update node position
 */
export async function updateNodePosition(
	nodeId: string,
	x: number,
	y: number
): Promise<void> {
	const response = await fetch(`${API_BASE}/messages/${nodeId}/position`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ positionX: x, positionY: y }),
	});

	if (!response.ok) {
		throw new Error(`Failed to update position: ${response.statusText}`);
	}
}

/**
 * Batch update positions (for multi-drag)
 */
export async function batchUpdatePositions(
	updates: Array<{ id: string; positionX: number; positionY: number }>
): Promise<void> {
	const response = await fetch(`${API_BASE}/messages/batch/position`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ updates }),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to batch update positions: ${response.statusText}`
		);
	}
}

/**
 * Attach node to new parent (or detach with null)
 */
export async function attachNodeToParent(
	nodeId: string,
	parentId: string | null
): Promise<void> {
	const response = await fetch(`${API_BASE}/messages/${nodeId}/attach`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ parentMessageId: parentId }),
	});

	if (!response.ok) {
		throw new Error(`Failed to attach node: ${response.statusText}`);
	}
}

/**
 * Atomic drop operation: attach + update position
 */
export async function attachAndUpdatePosition(
	nodeId: string,
	parentId: string | null,
	x: number,
	y: number
): Promise<void> {
	const response = await fetch(`${API_BASE}/messages/${nodeId}/drop`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			parentMessageId: parentId,
			positionX: x,
			positionY: y,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to drop node: ${response.statusText}`);
	}
}

/**
 * Duplicate node
 */
export async function duplicateNode(nodeId: string): Promise<GraphNode> {
	const response = await fetch(`${API_BASE}/messages/${nodeId}/duplicate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Failed to duplicate node: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Delete node (with or without children)
 */
export async function deleteNode(
	nodeId: string,
	keepReplies: boolean = false
): Promise<{ deletedIds: string[] }> {
	const response = await fetch(
		`${API_BASE}/messages/${nodeId}?keepReplies=${keepReplies}`,
		{
			method: "DELETE",
		}
	);

	if (!response.ok) {
		throw new Error(`Failed to delete node: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Delete entire thread (node + all descendants)
 */
export async function deleteThread(
	nodeId: string
): Promise<{ deletedIds: string[] }> {
	return deleteNode(nodeId, false);
}
