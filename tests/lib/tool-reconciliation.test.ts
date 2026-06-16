import { reconcileStaleToolExecutions } from "@/lib/tools/reconciliation";
import type { ToolPrismaClient } from "@/lib/tools/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
}));

describe("tool execution reconciliation", () => {
	it("times out abandoned executions and expires old confirmations", async () => {
		const updateMany = vi
			.fn()
			.mockResolvedValueOnce({ count: 2 })
			.mockResolvedValueOnce({ count: 3 });
		const prismaClient = {
			toolExecution: {
				updateMany,
			},
		} as unknown as ToolPrismaClient;
		const now = new Date("2026-06-14T12:00:00.000Z");

		const result = await reconcileStaleToolExecutions({
			prismaClient,
			now,
			runningStaleMs: 120_000,
			confirmationStaleMs: 86_400_000,
		});

		expect(result).toEqual({
			staleRunningCount: 2,
			expiredConfirmationCount: 3,
		});
		expect(updateMany).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				where: {
					status: "running",
					startedAt: {
						lt: new Date("2026-06-14T11:58:00.000Z"),
					},
				},
				data: expect.objectContaining({
					status: "timed_out",
					errorCode: "TOOL_EXECUTION_ABANDONED",
					completedAt: now,
				}),
			})
		);
		expect(updateMany).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				where: {
					status: "pending_confirmation",
					createdAt: {
						lt: new Date("2026-06-13T12:00:00.000Z"),
					},
				},
				data: expect.objectContaining({
					status: "cancelled",
					errorCode: "TOOL_CONFIRMATION_EXPIRED",
					completedAt: now,
				}),
			})
		);
	});
});
