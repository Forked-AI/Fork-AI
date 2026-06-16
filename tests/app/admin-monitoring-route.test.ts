import { GET } from "@/app/api/admin/monitoring/metrics/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	aggregate: vi.fn(),
	groupBy: vi.fn(),
	findMany: vi.fn(),
	count: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		operationalMetric: {
			aggregate: mocks.aggregate,
			groupBy: mocks.groupBy,
			findMany: mocks.findMany,
			count: mocks.count,
		},
	},
}));

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

describe("GET /api/admin/monitoring/metrics", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.aggregate.mockReset();
		mocks.groupBy.mockReset();
		mocks.findMany.mockReset();
		mocks.count.mockReset();
	});

	it("requires authentication and the admin role", async () => {
		mocks.getSession.mockResolvedValueOnce(null);
		await expect(
			GET(new Request("http://localhost/api/admin/monitoring/metrics"))
		).resolves.toMatchObject({ status: 401 });

		mocks.getSession.mockResolvedValueOnce({
			user: { id: "user-1", role: "user" },
		});
		await expect(
			GET(new Request("http://localhost/api/admin/monitoring/metrics"))
		).resolves.toMatchObject({ status: 403 });
	});

	it("returns operational metric aggregates without private content", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin-1", role: "admin" },
		});
		mocks.aggregate.mockResolvedValue({
			_count: { _all: 1 },
			_avg: { durationMs: 250, ttftMs: 100, tokensPerSec: 42.5 },
			_sum: { totalTokens: 120, costTotal: 0.002 },
		});
		mocks.groupBy
			.mockResolvedValueOnce([
				{
					kind: "ai_provider",
					source: "chat_response",
					_count: { _all: 1 },
					_avg: { durationMs: 250 },
				},
			])
			.mockResolvedValueOnce([{ status: "success", _count: { _all: 1 } }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					provider: "mistral",
					model: "mistral-small",
					_count: { _all: 1 },
					_avg: { durationMs: 250, ttftMs: 100, tokensPerSec: 42.5 },
				},
			])
			.mockResolvedValueOnce([]);
		mocks.findMany.mockResolvedValue([
			{
				id: "metric-1",
				kind: "ai_provider",
				source: "chat_response",
				status: "success",
				route: null,
				job: null,
				provider: "mistral",
				model: "mistral-small",
				durationMs: 250,
				ttftMs: 100,
				tokensPerSec: 42.5,
				totalTokens: 120,
				costTotal: 0.002,
				errorCode: null,
				providerStatus: null,
				userId: "user-1",
				conversationId: "conversation-1",
				traceId: "usage-1",
				createdAt: new Date("2026-06-11T00:00:00.000Z"),
			},
		]);
		mocks.count
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(0)
			.mockResolvedValueOnce(0);

		const response = await GET(
			new Request(
				"http://localhost/api/admin/monitoring/metrics?kind=ai_provider"
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.totals).toMatchObject({
			events: 1,
			averageDurationMs: 250,
			averageTtftMs: 100,
			totalTokens: 120,
			generationCount: 1,
		});
		expect(payload.recent[0]).not.toHaveProperty("content");
		expect(payload.recent[0]).not.toHaveProperty("prompt");
		expect(payload.recent[0]).not.toHaveProperty("message");
		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				select: expect.not.objectContaining({
					metadataJson: expect.anything(),
				}),
			})
		);
	});
});
