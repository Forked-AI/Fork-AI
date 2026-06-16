import {
	buildUsageMeasurement,
	finalizeStaleUsageAttempts,
	finalizeUsageEvent,
} from "@/lib/usage/usage-service";
import { describe, expect, it, vi } from "vitest";

describe("usage service", () => {
	it("prefers provider usage and records resolved provider metadata", () => {
		expect(
			buildUsageMeasurement({
				requestedModel: "mistral-small-latest",
				resolvedModel: "mistral-small-2603",
				providerRequestId: "completion-1",
				providerUsage: { promptTokens: 10, completionTokens: 4 },
				estimatedInputTokens: 999,
				estimatedOutputTokens: 999,
				outcome: "completed",
			})
		).toMatchObject({
			inputTokens: 10,
			outputTokens: 4,
			billableUnits: 14,
			usageSource: "provider",
			resolvedModel: "mistral-small-2603",
			providerRequestId: "completion-1",
		});
	});

	it("uses estimates for partial failures and zero for immediate failures", () => {
		expect(
			buildUsageMeasurement({
				requestedModel: "mistral-small-latest",
				estimatedInputTokens: 12,
				estimatedOutputTokens: 3,
				outcome: "failed",
				hasPartialOutput: true,
			})
		).toMatchObject({
			inputTokens: 12,
			outputTokens: 3,
			usageSource: "estimate",
		});

		expect(
			buildUsageMeasurement({
				requestedModel: "mistral-small-latest",
				estimatedInputTokens: 12,
				estimatedOutputTokens: 3,
				outcome: "failed",
				hasPartialOutput: false,
			})
		).toMatchObject({
			inputTokens: 0,
			outputTokens: 0,
			billableUnits: 0,
			usageSource: "none",
		});
	});

	it("preserves available provider counts and estimates only missing counts", () => {
		expect(
			buildUsageMeasurement({
				requestedModel: "mistral-small-latest",
				providerUsage: { promptTokens: 10 },
				estimatedInputTokens: 99,
				estimatedOutputTokens: 4,
				outcome: "completed",
			})
		).toMatchObject({
			inputTokens: 10,
			outputTokens: 4,
			billableUnits: 14,
			usageSource: "estimate",
		});
	});

	it("finalizes and increments quota only once", async () => {
		let outcome = "pending";
		const prismaClient: any = {
			usageEvent: {
				findUnique: vi.fn(async () => ({
					id: "usage-1",
					userId: "user-1",
					outcome,
				})),
				updateMany: vi.fn(async () => {
					if (outcome !== "pending") return { count: 0 };
					outcome = "completed";
					return { count: 1 };
				}),
			},
			quotaLedger: { upsert: vi.fn(async () => ({ id: "quota-1" })) },
		};
		prismaClient.$transaction = vi.fn(async (callback) =>
			callback(prismaClient)
		);
		const measurement = buildUsageMeasurement({
			requestedModel: "mistral-small-latest",
			providerUsage: { promptTokens: 10, completionTokens: 5 },
			outcome: "completed",
		});

		await expect(
			finalizeUsageEvent({
				prismaClient,
				deduplicationKey: "generation:1",
				outcome: "completed",
				measurement,
				finalizedAt: new Date("2026-06-05T10:00:00.000Z"),
			})
		).resolves.toBe(true);
		await expect(
			finalizeUsageEvent({
				prismaClient,
				deduplicationKey: "generation:1",
				outcome: "completed",
				measurement,
				finalizedAt: new Date("2026-06-05T10:00:00.000Z"),
			})
		).resolves.toBe(false);

		expect(prismaClient.quotaLedger.upsert).toHaveBeenCalledTimes(1);
		expect(prismaClient.quotaLedger.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				update: expect.objectContaining({
					usedTokens: { increment: 15 },
				}),
			})
		);
	});

	it("finalizes stale non-generation attempts without double counting", async () => {
		let outcome = "pending";
		const prismaClient: any = {
			usageEvent: {
				findMany: vi.fn(async () => [
					{
						deduplicationKey: "conversation-title:1",
						requestedModel: "ministral-3b-latest",
					},
				]),
				findUnique: vi.fn(async () => ({
					id: "usage-1",
					userId: "user-1",
					outcome,
				})),
				updateMany: vi.fn(async () => {
					if (outcome !== "pending") return { count: 0 };
					outcome = "failed";
					return { count: 1 };
				}),
			},
			quotaLedger: { upsert: vi.fn(async () => ({ id: "quota-1" })) },
		};
		prismaClient.$transaction = vi.fn(async (callback) =>
			callback(prismaClient)
		);

		await expect(
			finalizeStaleUsageAttempts({
				prismaClient,
				now: new Date("2026-06-05T10:30:00.000Z"),
				timeoutMs: 15 * 60 * 1000,
			})
		).resolves.toEqual({ count: 1 });
		expect(prismaClient.usageEvent.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					outcome: "failed",
					errorCode: "USAGE_ATTEMPT_TIMEOUT",
					billableUnits: 0,
				}),
			})
		);
		expect(prismaClient.quotaLedger.upsert).toHaveBeenCalledTimes(1);
	});
});
