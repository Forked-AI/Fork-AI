import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	userFindUnique: vi.fn(),
	queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: mocks.userFindUnique,
		},
		$queryRaw: mocks.queryRaw,
	},
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
}));

import { resolveSubscriptionEntitlement } from "@/lib/subscription";

describe("subscription entitlements", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
		mocks.userFindUnique.mockReset();
		mocks.queryRaw.mockReset();
		process.env.PRO_TRIAL_DAYS = "7";
		process.env.FREE_MONTHLY_TOKEN_BUDGET = "500";
		process.env.PRO_MONTHLY_TOKEN_BUDGET = "10000";
	});

	afterEach(() => {
		vi.useRealTimers();
		delete process.env.PRO_TRIAL_DAYS;
		delete process.env.FREE_MONTHLY_TOKEN_BUDGET;
		delete process.env.PRO_MONTHLY_TOKEN_BUDGET;
	});

	it("keeps personal signup trial behavior", async () => {
		mocks.userFindUnique.mockResolvedValue({
			createdAt: new Date("2026-06-14T00:00:00.000Z"),
		});
		mocks.queryRaw.mockResolvedValue([]);

		await expect(
			resolveSubscriptionEntitlement({ userId: "user-1" })
		).resolves.toMatchObject({
			tier: "trial",
			monthlyTokenBudget: 10000,
		});

		expect(mocks.queryRaw).toHaveBeenCalledWith(
			expect.anything(),
			"user-1"
		);
	});

	it("uses organization subscription state instead of member personal trial", async () => {
		mocks.userFindUnique.mockResolvedValue({
			createdAt: new Date("2026-06-14T00:00:00.000Z"),
		});
		mocks.queryRaw.mockResolvedValue([]);

		await expect(
			resolveSubscriptionEntitlement({
				userId: "user-1",
				organizationId: "org-1",
			})
		).resolves.toMatchObject({
			tier: "free",
			monthlyTokenBudget: 500,
			trialEndsAt: null,
		});

		expect(mocks.queryRaw).toHaveBeenCalledWith(expect.anything(), "org-1");
	});

	it("grants pro entitlement from an active organization subscription", async () => {
		mocks.userFindUnique.mockResolvedValue({
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		mocks.queryRaw.mockResolvedValue([
			{
				plan: "pro",
				status: "active",
				periodEnd: null,
				trialEnd: null,
				endedAt: null,
			},
		]);

		await expect(
			resolveSubscriptionEntitlement({
				userId: "user-1",
				organizationId: "org-1",
			})
		).resolves.toMatchObject({
			tier: "pro",
			monthlyTokenBudget: 10000,
		});
	});
});
