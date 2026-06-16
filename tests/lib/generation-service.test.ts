import {
	cancelGenerationByAssistantMessage,
	completeGeneration,
} from "@/lib/chat/generation-service";
import { describe, expect, it, vi } from "vitest";

describe("generation service", () => {
	it("persists cancellation for an active assistant generation", async () => {
		const prismaClient: any = {
			message: {
				findFirst: vi.fn(async () => ({
					id: "assistant-1",
					content: "Partial",
					status: "streaming",
					generationAsAssistantMessage: {
						id: "generation-1",
						status: "streaming",
						provider: "mistral",
						model: "mistral-small-latest",
						contextEstimatedTokens: 10,
					},
				})),
				updateMany: vi.fn(async () => ({ count: 1 })),
				findUnique: vi.fn(),
			},
			generation: {
				updateMany: vi.fn(async () => ({ count: 1 })),
			},
			usageEvent: {
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
		const now = new Date("2026-06-04T10:00:00.000Z");

		await expect(
			cancelGenerationByAssistantMessage({
				prismaClient,
				assistantMessageId: "assistant-1",
				userId: "user-1",
				now,
			})
		).resolves.toMatchObject({
			messageId: "assistant-1",
			generationId: "generation-1",
			status: "cancelled",
			content: "Partial",
		});

		expect(prismaClient.message.updateMany).toHaveBeenCalledWith({
			where: {
				id: "assistant-1",
				status: { in: ["pending", "streaming"] },
			},
			data: {
				status: "cancelled",
				isError: false,
				promptTokens: 10,
				completionTokens: 2,
				cancelledAt: now,
				lastChunkAt: now,
			},
		});
		expect(prismaClient.generation.updateMany).toHaveBeenCalledWith({
			where: {
				id: "generation-1",
				status: { in: ["pending", "streaming"] },
			},
			data: {
				status: "cancelled",
				promptTokens: 10,
				completionTokens: 2,
				cancelledAt: now,
				lastChunkAt: now,
			},
		});
	});

	it("does not complete a generation after the message became terminal", async () => {
		const prismaClient: any = {
			message: {
				updateMany: vi.fn(async () => ({ count: 0 })),
			},
			generation: {
				updateMany: vi.fn(),
			},
		};
		prismaClient.$transaction = vi.fn(async (callback) =>
			callback(prismaClient)
		);

		await expect(
			completeGeneration({
				prismaClient,
				assistantMessageId: "assistant-1",
				generationId: "generation-1",
				content: "Late content",
				usage: {
					inputTokens: 1,
					outputTokens: 1,
					billableUnits: 2,
					usageSource: "provider",
					resolvedModel: "mistral-small-2603",
					providerRequestId: "completion-1",
					estimatedCostUsd: "0.00000075",
					costIsEstimate: true,
					pricingVersion: "mistral-2026-06-05",
				},
			})
		).resolves.toBe(false);

		expect(prismaClient.generation.updateMany).not.toHaveBeenCalled();
	});
});
