/**
 * Graph Adapter Layer
 * Converts between fork-ai Message model and dragdropui GraphNode format
 */

import { prisma } from "./prisma";
import type { MessageNode } from "./tree";

type Message = Awaited<ReturnType<typeof prisma.message.findUnique>>;

export interface GraphNode extends MessageNode {
	id: string;
	role: string;
	text: string; // maps from message.content
	replyTo: string | null; // maps from message.parentMessageId
	parentMessageId: string | null; // alias for tree compatibility
	x: number;
	y: number;
	createdAt: number; // Unix timestamp
	isRootNode?: boolean;
	rootNodeName?: string | null;
	model?: string | null;
	isError?: boolean;
}

export interface ChatGraph {
	id: string; // conversationId
	nodes: GraphNode[];
}

// Alias for compatibility with dragdropui
export type ChatNode = GraphNode;

/**
 * Convert Message from database to GraphNode for UI
 */
export function messageToGraphNode(message: {
	id: string;
	role: string;
	content: string;
	parentMessageId: string | null;
	positionX: number | null;
	positionY: number | null;
	createdAt: Date;
	isRootNode?: boolean;
	rootNodeName?: string | null;
	model?: string | null;
	isError?: boolean;
}): GraphNode {
	return {
		id: message.id,
		role: message.role,
		text: message.content,
		replyTo: message.parentMessageId,
		parentMessageId: message.parentMessageId, // alias for tree compatibility
		x: message.positionX ?? 0,
		y: message.positionY ?? 0,
		createdAt: message.createdAt.getTime(),
		isRootNode: message.isRootNode,
		rootNodeName: message.rootNodeName,
		model: message.model,
		isError: message.isError,
	};
}

/**
 * Convert multiple messages to ChatGraph
 */
export function messagesToChatGraph(
	conversationId: string,
	messages: {
		id: string;
		role: string;
		content: string;
		parentMessageId: string | null;
		positionX: number | null;
		positionY: number | null;
		createdAt: Date;
		isRootNode?: boolean;
		rootNodeName?: string | null;
		model?: string | null;
		isError?: boolean;
	}[]
): ChatGraph {
	return {
		id: conversationId,
		nodes: messages.map(messageToGraphNode),
	};
}

/**
 * Extract GraphNode update data for API calls
 */
export function graphNodeToUpdateData(node: Partial<GraphNode>) {
	const data: {
		content?: string;
		parentMessageId?: string | null;
		positionX?: number;
		positionY?: number;
	} = {};

	if (node.text !== undefined) data.content = node.text;
	if (node.replyTo !== undefined) data.parentMessageId = node.replyTo;
	if (node.x !== undefined) data.positionX = node.x;
	if (node.y !== undefined) data.positionY = node.y;

	return data;
}
