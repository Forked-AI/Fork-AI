import { GET } from "@/app/api/admin/usage/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	findMany: vi.fn(),
	aggregate: vi.fn(),
	groupBy: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		usageEvent: {
			findMany: mocks.findMany,
			aggregate: mocks.aggregate,
			groupBy: mocks.groupBy,
		},
	},
}));

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

describe("GET /api/admin/usage", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.findMany.mockReset();
		mocks.aggregate.mockReset();
		mocks.groupBy.mockReset();
	});

	it("requires authentication and the admin role", async () => {
		mocks.getSession.mockResolvedValueOnce(null);
		await expect(
			GET(new Request("http://localhost/api/admin/usage"))
		).resolves.toMatchObject({ status: 401 });

		mocks.getSession.mockResolvedValueOnce({
			user: { id: "user-1", role: "user" },
		});
		await expect(
			GET(new Request("http://localhost/api/admin/usage"))
		).resolves.toMatchObject({ status: 403 });
	});

	it("returns filtered usage metadata without message content", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.findMany.mockResolvedValue([
			{
				id: "usage-1",
				userId: "user-1",
				conversationId: "conversation-1",
				messageId: "message-1",
				generationId: "generation-1",
				feature: "chat_response",
				outcome: "completed",
				provider: "mistral",
				requestedModel: "mistral-small-latest",
				resolvedModel: "mistral-small-2603",
				promptVersion: "chat-context-v1",
				providerRequestId: "completion-1",
				inputTokens: 10,
				outputTokens: 5,
				billableUnits: 15,
				usageSource: "provider",
				estimatedCostUsd: { toString: () => "0.00000450" },
				costIsEstimate: true,
				pricingVersion: "mistral-2026-06-05",
				errorCode: null,
				providerStatusCode: null,
				startedAt: new Date("2026-06-05T10:00:00.000Z"),
				finalizedAt: new Date("2026-06-05T10:00:01.000Z"),
				createdAt: new Date("2026-06-05T10:00:00.000Z"),
				user: { email: "user@example.com", name: "User" },
			},
		]);
		mocks.aggregate.mockResolvedValue({
			_count: { _all: 1 },
			_sum: {
				inputTokens: 10,
				outputTokens: 5,
				billableUnits: 15,
				estimatedCostUsd: { toString: () => "0.00000450" },
			},
		});
		mocks.groupBy
			.mockResolvedValueOnce([
				{
					provider: "mistral",
					requestedModel: "mistral-small-latest",
					resolvedModel: "mistral-small-2603",
					_count: { _all: 1 },
					_sum: {
						billableUnits: 15,
						estimatedCostUsd: { toString: () => "0.00000450" },
					},
				},
			])
			.mockResolvedValueOnce([
				{
					outcome: "completed",
					_count: { _all: 1 },
					_sum: { billableUnits: 15 },
				},
			])
			.mockResolvedValueOnce([
				{
					feature: "chat_response",
					_count: { _all: 1 },
					_sum: { billableUnits: 15 },
				},
			]);

		const response = await GET(
			new Request(
				"http://localhost/api/admin/usage?from=2026-06-01T00%3A00%3A00.000Z&to=2026-07-01T00%3A00%3A00.000Z&user=user%40example.com&outcome=completed"
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.totals).toEqual({
			events: 1,
			inputTokens: 10,
			outputTokens: 5,
			billableUnits: 15,
			estimatedCostUsd: "0.00000450",
		});
		expect(payload.events[0]).not.toHaveProperty("content");
		expect(payload.events[0]).not.toHaveProperty("prompt");
		expect(payload.breakdowns.byProvider[0]).toMatchObject({
			provider: "mistral",
			model: "mistral-small-2603",
			events: 1,
		});
		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ outcome: "completed" }),
				take: 26,
			})
		);
	});

	it("applies provider and model filters with cursor pagination", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.findMany.mockResolvedValue([
			{
				id: "usage-2",
				estimatedCostUsd: null,
				user: null,
			},
			{
				id: "usage-1",
				estimatedCostUsd: null,
				user: null,
			},
		]);
		mocks.aggregate.mockResolvedValue({
			_count: { _all: 2 },
			_sum: {
				inputTokens: null,
				outputTokens: null,
				billableUnits: null,
				estimatedCostUsd: null,
			},
		});
		mocks.groupBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const response = await GET(
			new Request(
				"http://localhost/api/admin/usage?provider=mistral&model=mistral-small-2603&cursor=usage-3&limit=1"
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.events).toHaveLength(1);
		expect(payload.nextCursor).toBe("usage-2");
		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					provider: "mistral",
					OR: [
						{ requestedModel: "mistral-small-2603" },
						{ resolvedModel: "mistral-small-2603" },
					],
				}),
				cursor: { id: "usage-3" },
				skip: 1,
				take: 2,
			})
		);
	});
});
