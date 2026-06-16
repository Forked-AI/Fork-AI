import {
	buildGuestMessageHistory,
	loadMessageHistory,
} from "@/lib/chat/message-history";
import { describe, expect, it, vi } from "vitest";

function createPrismaMock() {
	return {
		message: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
		},
	};
}

describe("message history", () => {
	it("loads authenticated linear history in creation order", async () => {
		const prismaClient = createPrismaMock();
		prismaClient.message.findMany.mockResolvedValue([
			{ role: "user", content: "First prompt" },
			{ role: "system", content: "Ignored system message" },
			{ role: "assistant", content: "First reply" },
		]);

		await expect(
			loadMessageHistory({
				conversationId: "conversation-1",
				prismaClient,
			})
		).resolves.toEqual([
			{ role: "user", content: "First prompt" },
			{ role: "assistant", content: "First reply" },
		]);
		expect(prismaClient.message.findMany).toHaveBeenCalledWith({
			where: { conversationId: "conversation-1" },
			orderBy: { createdAt: "asc" },
			select: { role: true, content: true },
		});
	});

	it("walks branch ancestors from root to selected parent", async () => {
		const prismaClient = createPrismaMock();
		const nodes = new Map([
			[
				"assistant-1",
				{
					role: "assistant",
					content: "Root reply",
					parentMessageId: "user-1",
				},
			],
			[
				"user-1",
				{
					role: "user",
					content: "Root prompt",
					parentMessageId: null,
				},
			],
		]);
		prismaClient.message.findFirst.mockImplementation(
			async ({ where }: { where: { id: string } }) =>
				nodes.get(where.id) ?? null
		);

		await expect(
			loadMessageHistory({
				conversationId: "conversation-1",
				parentMessageId: "assistant-1",
				prismaClient,
			})
		).resolves.toEqual([
			{ role: "user", content: "Root prompt" },
			{ role: "assistant", content: "Root reply" },
		]);
		expect(prismaClient.message.findFirst).toHaveBeenNthCalledWith(1, {
			where: {
				id: "assistant-1",
				conversationId: "conversation-1",
			},
			select: {
				role: true,
				content: true,
				parentMessageId: true,
			},
		});
		expect(prismaClient.message.findFirst).toHaveBeenNthCalledWith(2, {
			where: {
				id: "user-1",
				conversationId: "conversation-1",
			},
			select: {
				role: true,
				content: true,
				parentMessageId: true,
			},
		});
	});

	it("builds guest history from client history plus the current prompt", () => {
		expect(
			buildGuestMessageHistory(
				[
					{ role: "user", content: "First prompt" },
					{ role: "assistant", content: "First reply" },
				],
				"Next prompt"
			)
		).toEqual([
			{ role: "user", content: "First prompt" },
			{ role: "assistant", content: "First reply" },
			{ role: "user", content: "Next prompt" },
		]);
	});
});
