import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { GET as exportAccount } from "@/app/api/account/export/route";
import { POST as revokeShares } from "@/app/api/account/shares/revoke/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));
const prismaMocks = vi.hoisted(() => ({
	userFindUnique: vi.fn(),
	userDelete: vi.fn(),
	conversationFindMany: vi.fn(),
	sharedFindMany: vi.fn(),
	sharedUpdateMany: vi.fn(),
	usageEventFindMany: vi.fn(),
	quotaLedgerFindMany: vi.fn(),
	quotaLedgerDeleteMany: vi.fn(),
	fileObjectFindMany: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
	deleteStoredFileObjects: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: authMocks.getSession,
		},
	},
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		$transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
			Promise.all(operations)
		),
		user: {
			findUnique: prismaMocks.userFindUnique,
			delete: prismaMocks.userDelete,
		},
		conversation: {
			findMany: prismaMocks.conversationFindMany,
		},
		sharedConversation: {
			findMany: prismaMocks.sharedFindMany,
			updateMany: prismaMocks.sharedUpdateMany,
		},
		usageEvent: {
			findMany: prismaMocks.usageEventFindMany,
		},
		quotaLedger: {
			findMany: prismaMocks.quotaLedgerFindMany,
			deleteMany: prismaMocks.quotaLedgerDeleteMany,
		},
		fileObject: {
			findMany: prismaMocks.fileObjectFindMany,
		},
	},
}));

vi.mock("@/lib/rag/storage", () => ({
	deleteStoredFileObjects: storageMocks.deleteStoredFileObjects,
}));

vi.mock("@/lib/idempotency", () => ({
	getRequestIdempotencyActorKey: vi.fn(() => "account-delete:test"),
	getUserIdempotencyActorKey: vi.fn((userId: string) => `user:${userId}`),
	withJsonIdempotency: vi.fn(
		async (
			_request: Request,
			_options: unknown,
			handler: () => Promise<unknown>
		) => {
			const result = (await handler()) as {
				body: unknown;
				status?: number;
			};
			return Response.json(result.body, { status: result.status ?? 200 });
		}
	),
}));

vi.mock("next/headers", () => ({
	headers: async () => new Headers(),
}));

describe("account lifecycle routes", () => {
	beforeEach(() => {
		authMocks.getSession.mockReset();
		prismaMocks.userFindUnique.mockReset();
		prismaMocks.userDelete.mockReset();
		prismaMocks.conversationFindMany.mockReset();
		prismaMocks.sharedFindMany.mockReset();
		prismaMocks.sharedUpdateMany.mockReset();
		prismaMocks.usageEventFindMany.mockReset();
		prismaMocks.quotaLedgerFindMany.mockReset();
		prismaMocks.quotaLedgerDeleteMany.mockReset();
		prismaMocks.fileObjectFindMany.mockReset();
		storageMocks.deleteStoredFileObjects.mockReset();
		authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMocks.usageEventFindMany.mockResolvedValue([]);
		prismaMocks.quotaLedgerFindMany.mockResolvedValue([]);
		prismaMocks.quotaLedgerDeleteMany.mockResolvedValue({ count: 0 });
		prismaMocks.fileObjectFindMany.mockResolvedValue([]);
		storageMocks.deleteStoredFileObjects.mockResolvedValue(undefined);
	});

	it("exports conversations and shares as JSON", async () => {
		prismaMocks.userFindUnique.mockResolvedValue({
			id: "user-1",
			name: "Viewer",
			email: "viewer@example.com",
			emailVerified: true,
			createdAt: new Date("2026-04-08T00:00:00.000Z"),
			updatedAt: new Date("2026-04-09T00:00:00.000Z"),
		});
		prismaMocks.conversationFindMany.mockResolvedValue([
			{
				id: "conversation-1",
				title: "Thread",
				collectionId: null,
				collection: null,
				isPinned: false,
				pinnedAt: null,
				activeMessageIds: null,
				createdAt: new Date("2026-04-08T00:00:00.000Z"),
				updatedAt: new Date("2026-04-08T01:00:00.000Z"),
				messages: [
					{
						id: "message-1",
						role: "user",
						content: "Prompt",
						model: null,
						promptTokens: null,
						completionTokens: null,
						isError: false,
						parentMessageId: null,
						createdAt: new Date("2026-04-08T00:00:00.000Z"),
					},
				],
				summaries: [],
			},
		]);
		prismaMocks.sharedFindMany.mockResolvedValue([
			{
				id: "share-1",
				conversationId: "conversation-1",
				shareToken: "token-1",
				selectedMessageIds: "[]",
				snapshotData: "[]",
				summaryData: null,
				maskingData: "{}",
				title: "Share",
				createdAt: new Date("2026-04-08T02:00:00.000Z"),
				expiresAt: null,
				isActive: true,
				accessCount: 1,
				allowDownload: false,
				showTimestamps: true,
				showModel: true,
			},
		]);

		const response = await exportAccount(
			new Request("http://localhost/api/account/export")
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain(
			"application/json"
		);
		const payload = await response.json();
		expect(payload.profile.email).toBe("viewer@example.com");
		expect(payload.conversations).toHaveLength(1);
		expect(payload.shares).toHaveLength(1);
		expect(payload.usageEvents).toEqual([]);
		expect(payload.quotaLedgers).toEqual([]);
	});

	it("revokes all active shares for the authenticated user", async () => {
		prismaMocks.sharedUpdateMany.mockResolvedValue({ count: 3 });

		const response = await revokeShares(
			new Request("http://localhost/api/account/shares/revoke", {
				method: "POST",
			})
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			success: true,
			revokedCount: 3,
		});
		expect(prismaMocks.sharedUpdateMany).toHaveBeenCalledWith({
			where: {
				createdBy: "user-1",
				isActive: true,
			},
			data: { isActive: false },
		});
	});

	it("requires explicit confirmation before account deletion", async () => {
		const response = await deleteAccount(
			new Request("http://localhost/api/account/delete", {
				method: "POST",
				body: JSON.stringify({ confirmation: "delete" }),
			})
		);

		expect(response.status).toBe(400);
		expect(prismaMocks.userDelete).not.toHaveBeenCalled();
	});

	it("deletes the authenticated account with confirmation", async () => {
		prismaMocks.userDelete.mockResolvedValue({ id: "user-1" });
		prismaMocks.fileObjectFindMany.mockResolvedValue([
			{
				storageProvider: "local",
				storageKey: "user-1/file-1.md",
			},
		]);

		const response = await deleteAccount(
			new Request("http://localhost/api/account/delete", {
				method: "POST",
				body: JSON.stringify({ confirmation: "DELETE" }),
			})
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			success: true,
			status: "deleted",
		});
		expect(storageMocks.deleteStoredFileObjects).toHaveBeenCalledWith([
			{
				storageProvider: "local",
				storageKey: "user-1/file-1.md",
			},
		]);
		expect(prismaMocks.userDelete).toHaveBeenCalledWith({
			where: { id: "user-1" },
		});
		expect(prismaMocks.quotaLedgerDeleteMany).toHaveBeenCalledWith({
			where: { subjectType: "user", subjectId: "user-1" },
		});
	});
});
