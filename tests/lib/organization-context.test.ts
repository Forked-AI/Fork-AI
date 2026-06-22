import {
	resolveWorkspaceContext,
	tenantDataScope,
} from "@/lib/organizations/context";
import { describe, expect, it, vi } from "vitest";

function createPrismaClient(role: string | null) {
	return {
		member: {
			findFirst: vi.fn(async () => (role ? { role } : null)),
		},
	} as any;
}

describe("organization workspace context", () => {
	it("resolves personal workspace when no active organization is set", async () => {
		const prismaClient = createPrismaClient(null);
		const result = await resolveWorkspaceContext({
			session: {
				user: { id: "user-1" },
				session: { activeOrganizationId: null },
			} as any,
			prismaClient,
		});

		expect(result).toMatchObject({
			ok: true,
			workspace: {
				userId: "user-1",
				organizationId: null,
				role: null,
				isPersonal: true,
			},
		});
		if (result.ok) {
			expect(tenantDataScope(result.workspace)).toEqual({
				userId: "user-1",
				organizationId: null,
			});
		}
		expect(prismaClient.member.findFirst).not.toHaveBeenCalled();
	});

	it("requires membership for the active organization", async () => {
		const prismaClient = createPrismaClient(null);
		const result = await resolveWorkspaceContext({
			session: {
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
			} as any,
			prismaClient,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(403);
		}
		expect(prismaClient.member.findFirst).toHaveBeenCalledWith({
			where: { userId: "user-1", organizationId: "org-1" },
			select: { role: true },
		});
	});

	it("enforces role permissions for organization workspaces", async () => {
		const prismaClient = createPrismaClient("viewer");
		const result = await resolveWorkspaceContext({
			session: {
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
			} as any,
			requiredPermission: "workspace:write",
			prismaClient,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(403);
		}
	});

	it("returns normalized role and organization scope for members", async () => {
		const prismaClient = createPrismaClient("admin");
		const result = await resolveWorkspaceContext({
			session: {
				user: { id: "user-1" },
				session: { activeOrganizationId: "org-1" },
			} as any,
			requiredPermission: "workspace:write",
			prismaClient,
		});

		expect(result).toMatchObject({
			ok: true,
			workspace: {
				userId: "user-1",
				organizationId: "org-1",
				role: "admin",
				isPersonal: false,
			},
		});
	});
});
