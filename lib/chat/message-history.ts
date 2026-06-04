import {
	type ConversationMessage,
	toConversationMessages,
} from "@/lib/chat-system-prompt";
import { prisma } from "@/lib/prisma";

export interface MessageHistoryPrismaClient {
	message: {
		findMany(args: {
			where: { conversationId: string };
			orderBy: { createdAt: "asc" };
			select: { role: true; content: true };
		}): Promise<Array<{ role: string; content: string }>>;
		findFirst(args: {
			where: { id: string; conversationId: string };
			select: {
				role: true;
				content: true;
				parentMessageId: true;
			};
		}): Promise<{
			role: string;
			content: string;
			parentMessageId: string | null;
		} | null>;
	};
}

export interface LoadMessageHistoryInput {
	conversationId: string;
	parentMessageId?: string | null;
	prismaClient?: MessageHistoryPrismaClient;
}

export async function loadMessageHistory({
	conversationId,
	parentMessageId,
	prismaClient = prisma as unknown as MessageHistoryPrismaClient,
}: LoadMessageHistoryInput): Promise<ConversationMessage[]> {
	if (!parentMessageId) {
		const linearMessages = await prismaClient.message.findMany({
			where: { conversationId },
			orderBy: { createdAt: "asc" },
			select: { role: true, content: true },
		});

		return toConversationMessages(linearMessages);
	}

	const ancestorPath: Array<{
		role: string;
		content: string;
	}> = [];
	let currentId: string | null = parentMessageId;

	while (currentId) {
		const messageNode = await prismaClient.message.findFirst({
			where: {
				id: currentId,
				conversationId,
			},
			select: {
				role: true,
				content: true,
				parentMessageId: true,
			},
		});

		if (!messageNode) {
			break;
		}

		ancestorPath.unshift({
			role: messageNode.role,
			content: messageNode.content,
		});

		currentId = messageNode.parentMessageId ?? null;
	}

	return toConversationMessages(ancestorPath);
}

export function buildGuestMessageHistory(
	history: ConversationMessage[] | undefined,
	message: string
): ConversationMessage[] {
	return [...(history ?? []), { role: "user", content: message }];
}
