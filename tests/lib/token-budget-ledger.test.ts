import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
	resolveSubscriptionEntitlement: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		quotaLedger: { findUnique: mocks.findUnique },
	},
}));

vi.mock("@/lib/subscription", () => ({
	resolveSubscriptionEntitlement: mocks.resolveSubscriptionEntitlement,
}));

import {
	checkTokenBudgetBeforeRequest,
	getTokenBudgetStatus,
} from "@/lib/token-budget";

describe("ledger-backed token budget", () => {
	beforeEach(() => {
		mocks.findUnique.mockReset();
		mocks.resolveSubscriptionEntitlement.mockReset();
		mocks.resolveSubscriptionEntitlement.mockResolvedValue({
			tier: "free",
			monthlyTokenBudget: 1_000,
			usageWindowStart: new Date("2026-06-01T00:00:00.000Z"),
			usageWindowEnd: new Date("2026-07-01T00:00:00.000Z"),
			trialEndsAt: null,
		});
	});

	it("reports usage from the quota ledger", async () => {
		mocks.findUnique.mockResolvedValue({ usedTokens: 750 });

		await expect(getTokenBudgetStatus("user-1")).resolves.toMatchObject({
			usagePercent: 75,
			usageBand: "high",
		});
		expect(mocks.findUnique).toHaveBeenCalledWith({
			where: {
				subjectType_subjectId_windowStart_windowEnd: {
					subjectType: "user",
					subjectId: "user-1",
					windowStart: new Date("2026-06-01T00:00:00.000Z"),
					windowEnd: new Date("2026-07-01T00:00:00.000Z"),
				},
			},
			select: { usedTokens: true },
		});
		expect(mocks.resolveSubscriptionEntitlement).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: undefined,
		});
	});

	it("reports organization usage from the organization quota ledger", async () => {
		mocks.findUnique.mockResolvedValue({ usedTokens: 250 });

		await expect(
			getTokenBudgetStatus("user-1", "org-1")
		).resolves.toMatchObject({
			usagePercent: 25,
			usageBand: "low",
		});
		expect(mocks.resolveSubscriptionEntitlement).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: "org-1",
		});
		expect(mocks.findUnique).toHaveBeenCalledWith({
			where: {
				subjectType_subjectId_windowStart_windowEnd: {
					subjectType: "organization",
					subjectId: "org-1",
					windowStart: new Date("2026-06-01T00:00:00.000Z"),
					windowEnd: new Date("2026-07-01T00:00:00.000Z"),
				},
			},
			select: { usedTokens: true },
		});
	});

	it("blocks requests whose estimate would exceed the ledger budget", async () => {
		mocks.findUnique.mockResolvedValue({ usedTokens: 900 });
		process.env.TOKEN_COMPLETION_RESERVE = "100";

		await expect(
			checkTokenBudgetBeforeRequest("user-1", [{ content: "1234" }])
		).resolves.toMatchObject({ allowed: false, usagePercent: 90 });

		delete process.env.TOKEN_COMPLETION_RESERVE;
	});
});
