import { POST } from "@/app/api/marketplace/posts/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	checkRequestRateLimit: vi.fn(),
	resolveWorkspaceContext: vi.fn(),
	withJsonIdempotency: vi.fn(),
	createMarketplacePost: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/api-rate-limit", () => ({
	checkRequestRateLimit: mocks.checkRequestRateLimit,
}));

vi.mock("@/lib/idempotency", () => ({
	getUserIdempotencyActorKey: (userId: string) => `user:${userId}`,
	withJsonIdempotency: mocks.withJsonIdempotency,
}));

vi.mock("@/lib/organizations/context", () => ({
	resolveWorkspaceContext: mocks.resolveWorkspaceContext,
}));

vi.mock("@/lib/marketplace/posts", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/marketplace/posts")>();
	return {
		...actual,
		createMarketplacePost: mocks.createMarketplacePost,
		listPublicMarketplacePosts: vi.fn(),
	};
});

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

function jsonRequest(body: unknown) {
	return new Request("http://localhost/api/marketplace/posts", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Idempotency-Key": "marketplace-test",
		},
		body: JSON.stringify(body),
	});
}

describe("marketplace post API route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		mocks.checkRequestRateLimit.mockResolvedValue({ allowed: true });
		mocks.resolveWorkspaceContext.mockResolvedValue({
			ok: true,
			workspace: { organizationId: null },
		});
		mocks.withJsonIdempotency.mockImplementation(
			async (_request, _options, handler) => {
				const result = await handler();
				return Response.json(result.body, {
					status: result.status ?? 200,
				});
			}
		);
	});

	it("requires authentication before creating marketplace posts", async () => {
		mocks.getSession.mockResolvedValue(null);

		const response = await POST(
			jsonRequest({
				conversationId: "conversation-1",
				messageIds: ["msg-1"],
				title: "Public result",
			})
		);

		expect(response.status).toBe(401);
		expect(mocks.createMarketplacePost).not.toHaveBeenCalled();
	});

	it("validates that create requests name a share or selected messages", async () => {
		const response = await POST(
			jsonRequest({
				title: "Public result",
				visibility: "public",
			})
		);

		expect(response.status).toBe(400);
		expect(mocks.withJsonIdempotency).not.toHaveBeenCalled();
	});

	it("creates posts through workspace-scoped idempotency", async () => {
		mocks.createMarketplacePost.mockResolvedValue({
			status: 201,
			error: null,
			post: { id: "post-1", title: "Public result" },
		});

		const response = await POST(
			jsonRequest({
				conversationId: "conversation-1",
				messageIds: ["msg-1"],
				title: "Public result",
				summary: "",
				visibility: "unlisted",
			})
		);

		expect(response.status).toBe(201);
		expect(mocks.resolveWorkspaceContext).toHaveBeenCalledWith(
			expect.objectContaining({ requiredPermission: "workspace:write" })
		);
		expect(mocks.withJsonIdempotency).toHaveBeenCalledWith(
			expect.any(Request),
			expect.objectContaining({
				scope: "marketplace:post:create",
				actorKey: "user:user-1",
			}),
			expect.any(Function)
		);
		expect(mocks.createMarketplacePost).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: null,
			input: expect.objectContaining({
				conversationId: "conversation-1",
				messageIds: ["msg-1"],
				visibility: "unlisted",
			}),
		});
	});
});
