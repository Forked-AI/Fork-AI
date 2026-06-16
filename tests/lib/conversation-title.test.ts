import {
	generateConversationTitle,
	ConversationTitleGenerationError,
} from "@/lib/conversations/generate-title";
import { describe, expect, it, vi } from "vitest";

function createPrismaMock() {
	const prismaClient: any = {
		conversation: {
			findFirst: vi.fn(),
			update: vi.fn(),
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
		quotaLedger: { upsert: vi.fn() },
	};
	prismaClient.$transaction = vi.fn(async (callback) =>
		callback(prismaClient)
	);
	return prismaClient;
}

describe("conversation title generation", () => {
	it("uses the provider abstraction and records usage", async () => {
		const prismaClient = createPrismaMock();
		prismaClient.conversation.findFirst.mockResolvedValue({
			id: "conversation-1",
			title: "Old title",
			messages: [
				{ role: "user", content: "Discuss usage ledgers" },
				{ role: "assistant", content: "Use idempotent events" },
			],
		});
		const provider = {
			complete: vi.fn(async () => ({
				content: "Usage Ledger Design",
				usage: { promptTokens: 20, completionTokens: 4 },
				providerRequestId: "completion-1",
				resolvedModel: "ministral-3b-2512",
			})),
			stream: vi.fn(),
		};

		await expect(
			generateConversationTitle({
				conversationId: "conversation-1",
				userId: "user-1",
				prismaClient,
				provider,
				model: "ministral-3b-latest",
			})
		).resolves.toEqual({
			title: "Usage Ledger Design",
			conversationId: "conversation-1",
		});

		expect(provider.complete).toHaveBeenCalledTimes(1);
		expect(prismaClient.usageEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					feature: "conversation_title",
					outcome: "pending",
				}),
			})
		);
		expect(prismaClient.quotaLedger.upsert).toHaveBeenCalledTimes(1);
	});

	it("rejects unavailable models before creating a usage attempt", async () => {
		const prismaClient = createPrismaMock();
		prismaClient.conversation.findFirst.mockResolvedValue({
			id: "conversation-1",
			title: "Old title",
			messages: [
				{ role: "user", content: "Prompt" },
				{ role: "assistant", content: "Reply" },
			],
		});

		await expect(
			generateConversationTitle({
				conversationId: "conversation-1",
				userId: "user-1",
				prismaClient,
				model: "unsupported-model",
			})
		).rejects.toBeInstanceOf(ConversationTitleGenerationError);
		expect(prismaClient.usageEvent.create).not.toHaveBeenCalled();
	});
});
