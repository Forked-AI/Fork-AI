import { authorizeSubscriptionReference } from "@/lib/billing/subscription-reference";
import { describe, expect, it, vi } from "vitest";

function createPrismaClient(role: string | null) {
	return {
		member: {
			findFirst: vi.fn(async () => (role ? { role } : null)),
		},
	} as any;
}

describe("subscription reference authorization", () => {
	it("allows personal subscription actions only for the signed-in user reference", async () => {
		const prismaClient = createPrismaClient(null);

		await expect(
			authorizeSubscriptionReference({
				user: { id: "user-1" },
				referenceId: "user-1",
				action: "upgrade-subscription",
				prismaClient,
			})
		).resolves.toBe(true);

		expect(prismaClient.member.findFirst).not.toHaveBeenCalled();
	});

	it("allows org billing writes for billing admins in the active organization", async () => {
		const prismaClient = createPrismaClient("billing_admin");

		await expect(
			authorizeSubscriptionReference({
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
				referenceId: "org-1",
				customerType: "organization",
				action: "upgrade-subscription",
				prismaClient,
			})
		).resolves.toBe(true);

		expect(prismaClient.member.findFirst).toHaveBeenCalledWith({
			where: { userId: "user-1", organizationId: "org-1" },
			select: { role: true },
		});
	});

	it("rejects org billing writes for regular members and spoofed org references", async () => {
		const memberPrismaClient = createPrismaClient("member");
		await expect(
			authorizeSubscriptionReference({
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
				referenceId: "org-1",
				customerType: "organization",
				action: "cancel-subscription",
				prismaClient: memberPrismaClient,
			})
		).resolves.toBe(false);

		const adminPrismaClient = createPrismaClient("admin");
		await expect(
			authorizeSubscriptionReference({
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
				referenceId: "org-spoofed",
				customerType: "organization",
				action: "billing-portal",
				prismaClient: adminPrismaClient,
			})
		).resolves.toBe(false);
		expect(adminPrismaClient.member.findFirst).not.toHaveBeenCalled();
	});

	it("allows org billing reads for admins", async () => {
		const prismaClient = createPrismaClient("admin");

		await expect(
			authorizeSubscriptionReference({
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
				referenceId: "org-1",
				customerType: "organization",
				action: "list-subscription",
				prismaClient,
			})
		).resolves.toBe(true);
	});

	it("rejects organization references when the request is not an organization customer", async () => {
		const prismaClient = createPrismaClient("owner");

		await expect(
			authorizeSubscriptionReference({
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
				referenceId: "org-1",
				customerType: "user",
				action: "upgrade-subscription",
				prismaClient,
			})
		).resolves.toBe(false);
		expect(prismaClient.member.findFirst).not.toHaveBeenCalled();
	});
});
