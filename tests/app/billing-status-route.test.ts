import { GET } from "@/app/api/billing/status/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	resolveWorkspaceContext: vi.fn(),
	getTokenBudgetStatus: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: mocks.getSession,
		},
	},
}));

vi.mock("@/lib/organizations/context", () => ({
	resolveWorkspaceContext: mocks.resolveWorkspaceContext,
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
}));

vi.mock("@/lib/token-budget", () => ({
	getTokenBudgetStatus: mocks.getTokenBudgetStatus,
}));

vi.mock("next/headers", () => ({
	headers: async () => new Headers(),
}));

describe("/api/billing/status", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.resolveWorkspaceContext.mockReset();
		mocks.getTokenBudgetStatus.mockReset();
	});

	it("returns active organization billing status from the server session", async () => {
		const session = {
			user: { id: "user-1" },
			session: { activeOrganizationId: "org-1" },
		};
		mocks.getSession.mockResolvedValue(session);
		mocks.resolveWorkspaceContext.mockResolvedValue({
			ok: true,
			workspace: {
				userId: "user-1",
				organizationId: "org-1",
				role: "billing_admin",
				isPersonal: false,
			},
		});
		mocks.getTokenBudgetStatus.mockResolvedValue({
			tier: "pro",
			usagePercent: 33,
			usageBand: "low",
			trialEndsAt: null,
		});

		const response = await GET();
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(mocks.resolveWorkspaceContext).toHaveBeenCalledWith({
			session,
			requiredPermission: "workspace:read",
		});
		expect(mocks.getTokenBudgetStatus).toHaveBeenCalledWith(
			"user-1",
			"org-1"
		);
		expect(payload).toMatchObject({
			workspace: {
				customerType: "organization",
				referenceId: "org-1",
				canManageBilling: true,
			},
			plan: { tier: "pro", isTrial: false },
			usage: { percent: 33, band: "low" },
		});
	});

	it("keeps personal billing status unchanged", async () => {
		const session = { user: { id: "user-1" } };
		mocks.getSession.mockResolvedValue(session);
		mocks.resolveWorkspaceContext.mockResolvedValue({
			ok: true,
			workspace: {
				userId: "user-1",
				organizationId: null,
				role: null,
				isPersonal: true,
			},
		});
		mocks.getTokenBudgetStatus.mockResolvedValue({
			tier: "trial",
			usagePercent: 10,
			usageBand: "low",
			trialEndsAt: new Date("2026-07-01T00:00:00.000Z"),
		});

		const response = await GET();
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(mocks.getTokenBudgetStatus).toHaveBeenCalledWith("user-1", null);
		expect(payload).toMatchObject({
			workspace: {
				customerType: "user",
				referenceId: null,
				canManageBilling: true,
			},
			plan: { tier: "trial", isTrial: true },
		});
	});
});
