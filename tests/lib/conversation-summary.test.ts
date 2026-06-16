import {
	generateConversationSummary,
	getConversationSummaryGenerationInput,
} from "@/lib/conversations/generate-summary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createPrismaMock() {
	const prismaClient: any = {
		conversation: {
			findFirst: vi.fn(),
		},
		conversationSummary: {
			upsert: vi.fn(),
		},
		usageEvent: {
			create: vi.fn(async () => ({ id: "usage-1" })),
			findUnique: vi.fn(async () => ({
				id: "usage-1",
				userId: "user-1",
				outcome: "pending",
			})),
			updateMany: vi.fn(async () => ({ count: 1 })),
		},
		quotaLedger: {
			upsert: vi.fn(),
		},
	};
	prismaClient.$transaction = vi.fn(async (callback) =>
		callback(prismaClient)
	);
	return prismaClient;
}

describe("conversation summary generation", () => {
	beforeEach(() => {
		process.env.CHAT_SUMMARY_MIN_MESSAGES = "2";
	});

	afterEach(() => {
		delete process.env.CHAT_SUMMARY_MIN_MESSAGES;
		vi.restoreAllMocks();
	});

	it("loads only a user-owned conversation for summarization", async () => {
		const prismaClient = createPrismaMock();
		prismaClient.conversation.findFirst.mockResolvedValue(null);

		await expect(
			getConversationSummaryGenerationInput({
				conversationId: "conversation-1",
				userId: "user-1",
				prismaClient,
			})
		).rejects.toMatchObject({ code: "CONVERSATION_NOT_FOUND" });

		expect(prismaClient.conversation.findFirst).toHaveBeenCalledWith({
			where: {
				id: "conversation-1",
				userId: "user-1",
			},
			include: expect.any(Object),
		});
	});

	it("generates and upserts a derived summary with stable source metadata", async () => {
		const prismaClient = createPrismaMock();
		const provider = {
			complete: vi.fn(async () => ({
				content: "## Summary\nThe user wants a bounded context plan.",
				usage: { promptTokens: 10, completionTokens: 5 },
			})),
			stream: vi.fn(),
		};
		prismaClient.conversation.findFirst.mockResolvedValue({
			id: "conversation-1",
			messages: [
				{
					id: "message-1",
					role: "user",
					content: "How should context work?",
				},
				{
					id: "message-2",
					role: "assistant",
					content: "Use summaries and recent messages.",
				},
			],
			summaries: [
				{
					id: "summary-old",
					content: "Earlier summary.",
				},
			],
		});
		prismaClient.conversationSummary.upsert.mockResolvedValue({
			id: "summary-1",
			conversationId: "conversation-1",
			userId: "user-1",
			sourceMessageCount: 2,
			summarizedThroughMessageId: "message-2",
			promptVersion: "chat-context-v1",
		});

		await expect(
			generateConversationSummary({
				conversationId: "conversation-1",
				userId: "user-1",
				prismaClient,
				provider,
				model: "summary-model",
			})
		).resolves.toMatchObject({
			id: "summary-1",
			conversationId: "conversation-1",
			promptVersion: "chat-context-v1",
			model: "summary-model",
		});

		expect(provider.complete).toHaveBeenCalledWith({
			model: "summary-model",
			messages: [
				expect.objectContaining({ role: "system" }),
				expect.objectContaining({
					role: "user",
					content: expect.stringContaining(
						"Previous summary:\nEarlier summary."
					),
				}),
			],
		});
		expect(prismaClient.conversationSummary.upsert).toHaveBeenCalledWith({
			where: {
				conversationId_promptVersion_sourceFingerprint: {
					conversationId: "conversation-1",
					promptVersion: "chat-context-v1",
					sourceFingerprint: expect.any(String),
				},
			},
			update: expect.objectContaining({
				content: "## Summary\nThe user wants a bounded context plan.",
				userId: "user-1",
				model: "summary-model",
				sourceMessageCount: 2,
				summarizedThroughMessageId: "message-2",
			}),
			create: expect.objectContaining({
				conversationId: "conversation-1",
				userId: "user-1",
				promptVersion: "chat-context-v1",
				sourceFingerprint: expect.any(String),
			}),
			select: expect.any(Object),
		});
	});
});
