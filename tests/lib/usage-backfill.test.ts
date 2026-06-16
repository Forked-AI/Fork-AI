import {
	backfillUsageLedger,
	rebuildUserQuotaLedgers,
} from "@/lib/usage/backfill";
import { describe, expect, it, vi } from "vitest";

function createPrismaMock() {
	const prismaClient: any = {
		generation: { findMany: vi.fn() },
		message: { findMany: vi.fn() },
		usageEvent: {
			findMany: vi.fn(),
			create: vi.fn(),
		},
		quotaLedger: {
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
	};
	prismaClient.$transaction = vi.fn(async (callback) =>
		callback(prismaClient)
	);
	return prismaClient;
}

describe("usage ledger backfill", () => {
	it("supports a dry run without writing usage or quota rows", async () => {
		const prismaClient = createPrismaMock();
		prismaClient.generation.findMany
			.mockResolvedValueOnce([
				{
					id: "generation-1",
					userId: "user-1",
					conversationId: "conversation-1",
					assistantMessageId: "message-1",
					provider: "mistral",
					model: "mistral-small-latest",
					status: "completed",
					promptTokens: 10,
					completionTokens: 5,
					providerRequestId: null,
					errorCode: null,
					providerStatusCode: null,
					startedAt: new Date("2026-06-05T10:00:00.000Z"),
					completedAt: new Date("2026-06-05T10:00:01.000Z"),
					cancelledAt: null,
					createdAt: new Date("2026-06-05T10:00:00.000Z"),
					promptVersion: "chat-context-v1",
					contextEstimatedTokens: 12,
					assistantMessage: { content: "Reply" },
				},
			])
			.mockResolvedValueOnce([]);
		prismaClient.message.findMany.mockResolvedValue([]);
		prismaClient.usageEvent.findMany.mockResolvedValue([]);

		await expect(
			backfillUsageLedger({ prismaClient, dryRun: true, batchSize: 10 })
		).resolves.toEqual({
			staleAttempts: 0,
			generations: 1,
			legacyMessages: 0,
			quotaRows: 0,
		});
		expect(prismaClient.usageEvent.create).not.toHaveBeenCalled();
		expect(prismaClient.quotaLedger.deleteMany).not.toHaveBeenCalled();
	});

	it("rebuilds UTC monthly quota rows from terminal events", async () => {
		const prismaClient = createPrismaMock();
		prismaClient.usageEvent.findMany
			.mockResolvedValueOnce([
				{
					id: "usage-1",
					userId: "user-1",
					billableUnits: 15,
					estimatedCostUsd: "0.00000450",
					finalizedAt: new Date("2026-06-05T10:00:00.000Z"),
					createdAt: new Date("2026-06-05T09:59:59.000Z"),
				},
				{
					id: "usage-2",
					userId: "user-1",
					billableUnits: 5,
					estimatedCostUsd: null,
					finalizedAt: new Date("2026-06-06T10:00:00.000Z"),
					createdAt: new Date("2026-06-06T09:59:59.000Z"),
				},
			])
			.mockResolvedValueOnce([]);

		await expect(
			rebuildUserQuotaLedgers({ prismaClient, batchSize: 10 })
		).resolves.toBe(1);
		expect(prismaClient.quotaLedger.deleteMany).toHaveBeenCalledWith({
			where: { subjectType: "user" },
		});
		expect(prismaClient.quotaLedger.createMany).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					subjectType: "user",
					subjectId: "user-1",
					windowStart: new Date("2026-06-01T00:00:00.000Z"),
					windowEnd: new Date("2026-07-01T00:00:00.000Z"),
					usedTokens: 20,
					usedUsd: expect.objectContaining({}),
				}),
			],
		});
	});

	it("backfills failed generations and generation-less legacy messages in batches", async () => {
		const prismaClient = createPrismaMock();
		prismaClient.usageEvent.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);
		prismaClient.generation.findMany
			.mockResolvedValueOnce([
				{
					id: "generation-1",
					userId: "user-1",
					conversationId: "conversation-1",
					assistantMessageId: "message-1",
					provider: "mistral",
					model: "mistral-small-latest",
					status: "failed",
					promptTokens: null,
					completionTokens: null,
					providerRequestId: "completion-1",
					errorCode: "PROVIDER_ERROR",
					providerStatusCode: 500,
					startedAt: new Date("2026-05-31T23:59:58.000Z"),
					completedAt: null,
					cancelledAt: null,
					createdAt: new Date("2026-05-31T23:59:58.000Z"),
					promptVersion: "chat-context-v1",
					contextEstimatedTokens: 12,
					assistantMessage: { content: "" },
				},
			])
			.mockResolvedValueOnce([]);
		prismaClient.message.findMany
			.mockResolvedValueOnce([
				{
					id: "legacy-message-1",
					conversationId: "conversation-1",
					model: "mistral-small-latest",
					status: "completed",
					promptTokens: 8,
					completionTokens: 3,
					providerRequestId: null,
					errorCode: null,
					providerStatusCode: null,
					startedAt: null,
					completedAt: new Date("2026-06-01T00:00:02.000Z"),
					cancelledAt: null,
					createdAt: new Date("2026-06-01T00:00:00.000Z"),
					promptVersion: null,
					contextEstimatedTokens: null,
					content: "Legacy reply",
					conversation: { userId: "user-1" },
				},
			])
			.mockResolvedValueOnce([]);

		await expect(
			backfillUsageLedger({ prismaClient, batchSize: 1 })
		).resolves.toEqual({
			staleAttempts: 0,
			generations: 1,
			legacyMessages: 1,
			quotaRows: 0,
		});
		expect(prismaClient.generation.findMany).toHaveBeenCalledTimes(2);
		expect(prismaClient.message.findMany).toHaveBeenCalledTimes(2);
		expect(prismaClient.usageEvent.create).toHaveBeenCalledTimes(2);
		expect(prismaClient.usageEvent.create).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				data: expect.objectContaining({
					deduplicationKey: "generation:generation-1",
					outcome: "failed",
					usageSource: "legacy_unknown",
				}),
			})
		);
		expect(prismaClient.usageEvent.create).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				data: expect.objectContaining({
					deduplicationKey: "legacy-message:legacy-message-1",
					outcome: "completed",
					billableUnits: 11,
					usageSource: "legacy_unknown",
				}),
			})
		);
	});
});
