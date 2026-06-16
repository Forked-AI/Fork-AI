import { GET as GET_USER, PATCH } from "@/app/api/admin/users/[id]/route";
import { POST as IMPERSONATE } from "@/app/api/admin/users/[id]/impersonate/route";
import { POST as SET_PASSWORD } from "@/app/api/admin/users/[id]/password/route";
import { POST as REVOKE_SESSION } from "@/app/api/admin/users/[id]/sessions/[sessionId]/revoke/route";
import { POST as REVOKE_SESSIONS } from "@/app/api/admin/users/[id]/sessions/revoke-all/route";
import { POST as STOP_IMPERSONATING } from "@/app/api/admin/users/stop-impersonating/route";
import { GET, POST } from "@/app/api/admin/users/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	listUsers: vi.fn(),
	getUser: vi.fn(),
	createUser: vi.fn(),
	setRole: vi.fn(),
	banUser: vi.fn(),
	unbanUser: vi.fn(),
	setUserPassword: vi.fn(),
	listUserSessions: vi.fn(),
	revokeUserSession: vi.fn(),
	revokeUserSessions: vi.fn(),
	impersonateUser: vi.fn(),
	stopImpersonating: vi.fn(),
	userFindMany: vi.fn(),
	userFindUnique: vi.fn(),
	sessionFindUnique: vi.fn(),
	quotaFindMany: vi.fn(),
	auditCreate: vi.fn(),
	withJsonIdempotency: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: mocks.getSession,
			listUsers: mocks.listUsers,
			getUser: mocks.getUser,
			createUser: mocks.createUser,
			setRole: mocks.setRole,
			banUser: mocks.banUser,
			unbanUser: mocks.unbanUser,
			setUserPassword: mocks.setUserPassword,
			listUserSessions: mocks.listUserSessions,
			revokeUserSession: mocks.revokeUserSession,
			revokeUserSessions: mocks.revokeUserSessions,
			impersonateUser: mocks.impersonateUser,
			stopImpersonating: mocks.stopImpersonating,
		},
	},
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: {
			findMany: mocks.userFindMany,
			findUnique: mocks.userFindUnique,
		},
		session: {
			findUnique: mocks.sessionFindUnique,
		},
		quotaLedger: {
			findMany: mocks.quotaFindMany,
		},
		adminAuditEvent: {
			create: mocks.auditCreate,
		},
	},
}));

vi.mock("@/lib/idempotency", () => ({
	withJsonIdempotency: mocks.withJsonIdempotency,
}));

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

describe("admin users routes", () => {
	beforeEach(() => {
		Object.values(mocks).forEach((mock) => {
			if (typeof mock === "function") mock.mockReset();
		});
		mocks.withJsonIdempotency.mockImplementation(
			async (_request, _options, callback) => {
				const result = await callback();
				return Response.json(result.body, {
					status: result.status ?? 200,
				});
			}
		);
		mocks.quotaFindMany.mockResolvedValue([]);
		mocks.userFindMany.mockResolvedValue([]);
		mocks.listUserSessions.mockResolvedValue({ sessions: [] });
	});

	it("requires the admin role for user listing", async () => {
		mocks.getSession.mockResolvedValueOnce(null);
		await expect(
			GET(new Request("http://localhost/api/admin/users"))
		).resolves.toMatchObject({ status: 401 });

		mocks.getSession.mockResolvedValueOnce({
			user: { id: "user-1", role: "user" },
		});
		await expect(
			GET(new Request("http://localhost/api/admin/users"))
		).resolves.toMatchObject({ status: 403 });
	});

	it("lists users through Better Auth and joins safe Fork.AI metadata", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.listUsers.mockResolvedValue({
			users: [
				{
					id: "user-1",
					name: "User",
					email: "user@example.com",
					emailVerified: true,
					role: "user",
					banned: false,
					banReason: null,
					banExpires: null,
					createdAt: new Date("2026-06-01T00:00:00.000Z"),
					updatedAt: new Date("2026-06-02T00:00:00.000Z"),
				},
			],
			total: 1,
		});
		mocks.userFindMany.mockResolvedValue([
			{
				id: "user-1",
				stripeCustomerId: null,
				_count: {
					sessions: 1,
					conversations: 2,
					sharedConversations: 0,
					fileObjects: 1,
					usageEvents: 3,
					moderationEvents: 0,
					abuseSignals: 0,
				},
			},
		]);
		mocks.quotaFindMany.mockResolvedValue([
			{
				subjectId: "user-1",
				usedTokens: 123,
				usedUsd: { toString: () => "0.001" },
			},
		]);

		const response = await GET(
			new Request(
				"http://localhost/api/admin/users?search=user@example.com"
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(mocks.listUsers).toHaveBeenCalledWith(
			expect.objectContaining({
				query: expect.objectContaining({ searchField: "email" }),
			})
		);
		expect(payload.users[0].currentMonthUsage).toEqual({
			usedTokens: 123,
			usedUsd: "0.001",
		});
		expect(payload.users[0]).not.toHaveProperty("content");
		expect(payload.users[0]).not.toHaveProperty("snapshotData");
		expect(payload.users[0]).not.toHaveProperty("token");
	});

	it("creates users through the Better Auth admin plugin and audits", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.createUser.mockResolvedValue({
			user: {
				id: "user-1",
				email: "created@example.com",
				name: "Created",
				role: "user",
				banned: false,
			},
		});

		const response = await POST(
			new Request("http://localhost/api/admin/users", {
				method: "POST",
				headers: { "Idempotency-Key": "admin-user-create" },
				body: JSON.stringify({
					email: "created@example.com",
					name: "Created",
					password: "password123",
					role: "user",
				}),
			})
		);

		expect(response.status).toBe(200);
		expect(mocks.createUser).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ email: "created@example.com" }),
			})
		);
		expect(mocks.auditCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ action: "user.create" }),
			})
		);
	});

	it("updates role and ban state through Better Auth plugin operations", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.userFindUnique.mockResolvedValue({
			id: "user-1",
			role: "user",
			banned: false,
		});
		mocks.getUser.mockResolvedValue({
			id: "user-1",
			name: "User",
			email: "user@example.com",
			role: "admin",
			banned: true,
			banReason: "abuse",
			banExpires: null,
		});

		const response = await PATCH(
			new Request("http://localhost/api/admin/users/user-1", {
				method: "PATCH",
				headers: { "Idempotency-Key": "admin-user-update" },
				body: JSON.stringify({
					role: "admin",
					banned: true,
					banReason: "abuse",
				}),
			}),
			{ params: Promise.resolve({ id: "user-1" }) }
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.user).toMatchObject({ id: "user-1", role: "admin" });
		expect(mocks.setRole).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { userId: "user-1", role: "admin" },
			})
		);
		expect(mocks.banUser).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ userId: "user-1" }),
			})
		);
		expect(mocks.auditCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ action: "user.update" }),
			})
		);
	});

	it("returns safe user detail without message, file, token, or snapshot content", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.getUser.mockResolvedValue({
			id: "user-1",
			name: "User",
			email: "user@example.com",
			emailVerified: true,
			role: "user",
			banned: false,
			banReason: null,
			banExpires: null,
			createdAt: new Date("2026-06-01T00:00:00.000Z"),
			updatedAt: new Date("2026-06-02T00:00:00.000Z"),
		});
		mocks.userFindUnique.mockResolvedValue({
			stripeCustomerId: null,
			accounts: [],
			_count: {
				conversations: 1,
				sharedConversations: 0,
				fileObjects: 0,
				usageEvents: 0,
				moderationEvents: 0,
				abuseSignals: 0,
				messageAttachments: 0,
				sessions: 1,
			},
		});
		mocks.listUserSessions.mockResolvedValue({
			sessions: [
				{
					id: "session-1",
					token: "secret-token",
					createdAt: new Date("2026-06-01T00:00:00.000Z"),
					expiresAt: new Date("2026-06-02T00:00:00.000Z"),
					ipAddress: "127.0.0.1",
					userAgent: "Test",
				},
			],
		});

		const response = await GET_USER(
			new Request("http://localhost/api/admin/users/user-1"),
			{ params: Promise.resolve({ id: "user-1" }) }
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.user).not.toHaveProperty("conversations");
		expect(payload.user).not.toHaveProperty("messages");
		expect(payload.user).not.toHaveProperty("fileObjects");
		expect(payload.user.sessions[0]).not.toHaveProperty("token");
	});

	it("sets user passwords through the Better Auth admin plugin", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
		mocks.setUserPassword.mockResolvedValue({ success: true });

		const response = await SET_PASSWORD(
			new Request("http://localhost/api/admin/users/user-1/password", {
				method: "POST",
				headers: { "Idempotency-Key": "admin-user-set-password" },
				body: JSON.stringify({ newPassword: "new-password-123" }),
			}),
			{ params: Promise.resolve({ id: "user-1" }) }
		);

		expect(response.status).toBe(200);
		expect(mocks.setUserPassword).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { userId: "user-1", newPassword: "new-password-123" },
			})
		);
	});

	it("revokes one session by resolving token server-side only", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.sessionFindUnique.mockResolvedValue({
			id: "session-1",
			userId: "user-1",
			token: "secret-token",
		});
		mocks.revokeUserSession.mockResolvedValue({ success: true });

		const response = await REVOKE_SESSION(
			new Request(
				"http://localhost/api/admin/users/user-1/sessions/session-1/revoke",
				{
					method: "POST",
					headers: { "Idempotency-Key": "admin-user-revoke-session" },
				}
			),
			{
				params: Promise.resolve({
					id: "user-1",
					sessionId: "session-1",
				}),
			}
		);

		expect(response.status).toBe(200);
		expect(mocks.revokeUserSession).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { sessionToken: "secret-token" },
			})
		);
	});

	it("revokes all user sessions and blocks self-revocation before idempotency", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		await expect(
			REVOKE_SESSIONS(
				new Request(
					"http://localhost/api/admin/users/admin-1/sessions/revoke-all",
					{
						method: "POST",
						headers: {
							"Idempotency-Key": "admin-user-revoke-sessions",
						},
					}
				),
				{ params: Promise.resolve({ id: "admin-1" }) }
			)
		).resolves.toMatchObject({ status: 400 });

		mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
		const response = await REVOKE_SESSIONS(
			new Request(
				"http://localhost/api/admin/users/user-1/sessions/revoke-all",
				{
					method: "POST",
					headers: {
						"Idempotency-Key": "admin-user-revoke-sessions",
					},
				}
			),
			{ params: Promise.resolve({ id: "user-1" }) }
		);

		expect(response.status).toBe(200);
		expect(mocks.revokeUserSessions).toHaveBeenCalledWith(
			expect.objectContaining({ body: { userId: "user-1" } })
		);
	});

	it("impersonates non-admin users through the Better Auth admin plugin", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.userFindUnique.mockResolvedValue({ id: "user-1", role: "user" });
		mocks.impersonateUser.mockResolvedValue({
			user: { id: "user-1", email: "user@example.com", role: "user" },
		});

		const response = await IMPERSONATE(
			new Request("http://localhost/api/admin/users/user-1/impersonate", {
				method: "POST",
				headers: { "Idempotency-Key": "admin-user-impersonate" },
			}),
			{ params: Promise.resolve({ id: "user-1" }) }
		);

		expect(response.status).toBe(200);
		expect(mocks.impersonateUser).toHaveBeenCalledWith(
			expect.objectContaining({ body: { userId: "user-1" } })
		);
	});

	it("stops impersonation using the current impersonated session", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "user-1", role: "user" },
			session: { impersonatedBy: "admin-1" },
		});
		mocks.stopImpersonating.mockResolvedValue({
			user: { id: "admin-1", email: "admin@example.com", role: "admin" },
		});

		const response = await STOP_IMPERSONATING(
			new Request("http://localhost/api/admin/users/stop-impersonating", {
				method: "POST",
				headers: { "Idempotency-Key": "admin-stop-impersonating" },
			})
		);

		expect(response.status).toBe(200);
		expect(mocks.stopImpersonating).toHaveBeenCalledWith(
			expect.objectContaining({ headers: expect.any(Headers) })
		);
		expect(mocks.auditCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					actorId: "admin-1",
					action: "user.stop_impersonating",
				}),
			})
		);
	});
});
