import { useCallback, useMemo, useState } from "react";
import type { Message } from "./use-chat";

export interface MessageTreeReturn {
	// Map of parentId -> child messages (for sibling navigation)
	siblingsMap: Map<string | null, Message[]>;
	// Currently active message at each branch point
	activeMessageIds: Map<string | null, string>;
	// Get siblings for a message
	getSiblings: (message: Message) => Message[];
	// Get current index among siblings (1-based)
	getSiblingIndex: (message: Message) => number;
	// Navigate to previous/next sibling
	navigateSibling: (message: Message, direction: "prev" | "next") => void;
	// Get the active path from root to leaf
	getActivePath: (messages: Message[]) => Message[];
	// Get messages filtered for branch context (ancestors only)
	getAncestorPath: (messages: Message[], branchFromId: string) => Message[];
}

export function useMessageTree(messages: Message[]): MessageTreeReturn {
	// Track which sibling is active at each branch point
	// Key: parentMessageId (null for root), Value: active child message id
	const [activeMessageIds, setActiveMessageIds] = useState<
		Map<string | null, string>
	>(new Map());

	// Build sibling map: group messages by parentMessageId
	// Memoized for performance
	const siblingsMap = useMemo(() => {
		// Check if this is a legacy conversation (all messages have null parentMessageId)
		const allNull =
			messages.length > 0 && messages.every((m) => !m.parentMessageId);

		if (allNull && messages.length > 0) {
			// Legacy fallback: infer parent-child from chronological order
			// Pattern: null -> msg[0] -> msg[1] -> msg[2] -> ...
			const map = new Map<string | null, Message[]>();

			// First message has no parent (root)
			map.set(null, [messages[0]]);

			// Each subsequent message is a child of the previous
			for (let i = 1; i < messages.length; i++) {
				const parentId = messages[i - 1].id;
				if (!map.has(parentId)) {
					map.set(parentId, []);
				}
				map.get(parentId)!.push(messages[i]);
			}

			return map;
		}

		// Normal path: use actual parentMessageId values
		const map = new Map<string | null, Message[]>();

		for (const msg of messages) {
			const parentId = msg.parentMessageId ?? null;
			if (!map.has(parentId)) {
				map.set(parentId, []);
			}
			map.get(parentId)!.push(msg);
		}

		// Sort each group by createdAt
		for (const siblings of map.values()) {
			siblings.sort((a, b) => {
				const aTime = a.createdAt?.getTime() ?? 0;
				const bTime = b.createdAt?.getTime() ?? 0;
				return aTime - bTime;
			});
		}

		return map;
	}, [messages]);

	// Get siblings for a message
	const getSiblings = useCallback(
		(message: Message): Message[] => {
			const parentId = message.parentMessageId ?? null;
			return siblingsMap.get(parentId) ?? [message];
		},
		[siblingsMap]
	);

	// Get 1-based index among siblings
	const getSiblingIndex = useCallback(
		(message: Message): number => {
			const siblings = getSiblings(message);
			const index = siblings.findIndex((s) => s.id === message.id);
			return index + 1; // 1-based
		},
		[getSiblings]
	);

	// Navigate to previous or next sibling
	const navigateSibling = useCallback(
		(message: Message, direction: "prev" | "next") => {
			const siblings = getSiblings(message);
			const currentIndex = siblings.findIndex((s) => s.id === message.id);

			let newIndex: number;
			if (direction === "prev") {
				newIndex =
					currentIndex > 0 ? currentIndex - 1 : siblings.length - 1;
			} else {
				newIndex =
					currentIndex < siblings.length - 1 ? currentIndex + 1 : 0;
			}

			const newActiveMessage = siblings[newIndex];
			const parentId = message.parentMessageId ?? null;

			setActiveMessageIds((prev) => {
				const next = new Map(prev);
				next.set(parentId, newActiveMessage.id);
				return next;
			});
		},
		[getSiblings]
	);

	// Get the active path from root to the deepest active message
	// For linear conversations (no branching), this returns all messages in order
	// For branched conversations, this returns one message per branch point
	const getActivePath = useCallback(
		(allMessages: Message[]): Message[] => {
			// If no messages, return empty
			if (allMessages.length === 0) return [];

			// Check if this is a linear conversation (no branching)
			// A conversation is linear if no parent has more than one child
			let isLinear = true;
			for (const siblings of siblingsMap.values()) {
				if (siblings.length > 1) {
					isLinear = false;
					break;
				}
			}

			// For linear conversations, just return all messages sorted by time
			if (isLinear) {
				return [...allMessages].sort((a, b) => {
					const aTime = a.createdAt?.getTime() ?? 0;
					const bTime = b.createdAt?.getTime() ?? 0;
					return aTime - bTime;
				});
			}

			// For branched conversations, traverse the tree following active selections
			const path: Message[] = [];
			let currentParentId: string | null = null;

			while (true) {
				const children: Message[] =
					siblingsMap.get(currentParentId) ?? [];
				if (children.length === 0) break;

				// Find the active child, or default to first
				const activeId = activeMessageIds.get(currentParentId);
				const activeChild: Message = activeId
					? (children.find((c: Message) => c.id === activeId) ??
						children[0])
					: children[0];

				path.push(activeChild);
				currentParentId = activeChild.id;
			}

			return path;
		},
		[siblingsMap, activeMessageIds]
	);

	// Get ancestor path up to a specific message (for branching)
	const getAncestorPath = useCallback(
		(allMessages: Message[], branchFromId: string): Message[] => {
			const messageById = new Map(allMessages.map((m) => [m.id, m]));
			const ancestors: Message[] = [];

			// Walk up from branchFromId to root
			let currentId: string | null = branchFromId;
			while (currentId) {
				const msg = messageById.get(currentId);
				if (!msg) break;
				ancestors.unshift(msg); // Add to front
				currentId = msg.parentMessageId ?? null;
			}

			return ancestors;
		},
		[]
	);

	return {
		siblingsMap,
		activeMessageIds,
		getSiblings,
		getSiblingIndex,
		navigateSibling,
		getActivePath,
		getAncestorPath,
	};
}
