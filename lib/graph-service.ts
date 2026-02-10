/**
 * Graph Service Adapter
 * Provides localStorage-like interface but uses REST API
 * This allows dragdropui components to work with minimal changes
 */

import type { ChatGraph } from "./graph-adapter";
import * as api from "./graph-api";

// In-memory cache for conversation ID (set by GraphMap component)
let currentConversationId: string | null = null;

export function setConversationId(id: string) {
	currentConversationId = id;
}

export async function loadGraph(): Promise<ChatGraph> {
	if (!currentConversationId) {
		throw new Error("Conversation ID not set");
	}
	return api.fetchGraph(currentConversationId);
}

export async function saveGraph(graph: ChatGraph): Promise<ChatGraph> {
	// This is called by dragdropui mutations but we don't need it
	// since our API calls handle saves individually
	return graph;
}

// Export API functions for direct use
export { api };
