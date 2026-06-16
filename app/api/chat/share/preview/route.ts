import { auth } from "@/lib/auth";
import { checkChatRateLimit } from "@/lib/chat-rate-limit";
import { prisma } from "@/lib/prisma";
import { buildSharePreview } from "@/lib/share/service";
import { logServerError } from "@/lib/server-safe-log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_PREVIEW_MESSAGES = 100;
const MAX_PREVIEW_CHARS = 50000;

const previewShareSchema = z.object({
	conversationId: z.string().min(1),
	selectedMessageIds: z
		.array(z.string().min(1))
		.min(1)
		.max(MAX_PREVIEW_MESSAGES),
	autoMaskPII: z.boolean().optional().default(true),
	generateSummary: z.boolean().optional().default(false),
	approvedFindingIdsByMessageId: z
		.record(z.array(z.string().min(1)).max(30))
		.optional()
		.default({}),
	redactedMessageIds: z
		.array(z.string().min(1))
		.max(MAX_PREVIEW_MESSAGES)
		.optional()
		.default([]),
});

function sortMessageIds<T extends { id: string }>(
	messages: T[],
	messageIds: string[]
) {
	const messageMap = new Map(
		messages.map((message) => [message.id, message])
	);
	return messageIds
		.map((messageId) => messageMap.get(messageId))
		.filter((message): message is T => !!message);
}

function totalContentLength(messages: Array<{ content: string }>) {
	return messages.reduce((sum, message) => sum + message.content.length, 0);
}

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const parsed = previewShareSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const userId = session.user.id;
		const {
			conversationId,
			selectedMessageIds,
			autoMaskPII,
			generateSummary,
			approvedFindingIdsByMessageId,
			redactedMessageIds,
		} = parsed.data;

		const conversation = await prisma.conversation.findFirst({
			where: { id: conversationId, userId },
			select: { id: true },
		});
		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 }
			);
		}

		if (generateSummary) {
			const rateLimit = await checkChatRateLimit(userId, {
				maxRequests: 20,
				windowSeconds: 3600,
			});
			if (!rateLimit.allowed) {
				return NextResponse.json(
					{
						error: "Summary preview rate limit exceeded.",
						retryAfter: rateLimit.retryAfterSeconds,
						resetAt: rateLimit.resetAt.toISOString(),
					},
					{ status: 429 }
				);
			}
		}

		const messages = await prisma.message.findMany({
			where: {
				id: { in: selectedMessageIds },
				conversationId,
				role: { in: ["user", "assistant"] },
			},
			select: {
				id: true,
				role: true,
				content: true,
				model: true,
				createdAt: true,
			},
		});

		if (messages.length !== selectedMessageIds.length) {
			return NextResponse.json(
				{
					error: "One or more message IDs are invalid or do not belong to this conversation",
				},
				{ status: 400 }
			);
		}

		const orderedMessages = sortMessageIds(
			messages,
			selectedMessageIds
		).map((message) => ({
			...message,
			role: message.role as "user" | "assistant",
		}));
		if (orderedMessages.length !== selectedMessageIds.length) {
			return NextResponse.json(
				{ error: "Share preview selection is incomplete or invalid." },
				{ status: 400 }
			);
		}

		if (totalContentLength(orderedMessages) > MAX_PREVIEW_CHARS) {
			return NextResponse.json(
				{
					error: "Selected content is too large to prepare a preview.",
				},
				{ status: 400 }
			);
		}

		const preview = await buildSharePreview({
			userId,
			conversationId,
			messages: orderedMessages,
			autoMaskPII,
			generateSummary,
			approvedFindingIdsByMessageId,
			redactedMessageIds,
		});

		return NextResponse.json(preview);
	} catch (error) {
		logServerError("chat/share/preview", "preview_failed", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
