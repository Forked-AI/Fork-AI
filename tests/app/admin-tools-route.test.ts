import { GET } from "@/app/api/admin/tools/executions/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAdminSession: vi.fn(),
	findMany: vi.fn(),
	count: vi.fn(),
	groupBy: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
	requireAdminSession: mocks.requireAdminSession,
	parseAdminDateWindow: ({ from, to }: { from?: string; to?: string }) => ({
		ok: true,
		from: from ? new Date(from) : new Date("2026-06-04T00:00:00.000Z"),
		to: to ? new Date(to) : new Date("2026-06-11T00:00:00.000Z"),
	}),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		toolExecution: {
			findMany: mocks.findMany,
			count: mocks.count,
			groupBy: mocks.groupBy,
		},
	},
}));

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

describe("GET /api/admin/tools/executions", () => {
	beforeEach(() => {
		mocks.requireAdminSession.mockReset();
		mocks.findMany.mockReset();
		mocks.count.mockReset();
		mocks.groupBy.mockReset();
	});

	it("requires admin authorization", async () => {
		mocks.requireAdminSession.mockResolvedValue({
			ok: false,
			response: Response.json({ error: "Forbidden" }, { status: 403 }),
		});

		await expect(
			GET(new Request("http://localhost/api/admin/tools/executions"))
		).resolves.toMatchObject({ status: 403 });
	});

	it("returns metadata-only tool execution records", async () => {
		mocks.requireAdminSession.mockResolvedValue({
			ok: true,
			session: { user: { id: "admin-1", role: "admin" } },
		});
		mocks.findMany.mockResolvedValue([
			{
				id: "tool-exec-1",
				userId: "user-1",
				organizationId: null,
				conversationId: "conversation-1",
				messageId: null,
				toolName: "rag.retrieve_context",
				status: "succeeded",
				riskLevel: "low",
				requiresConfirmation: false,
				confirmedAt: null,
				inputSummaryJson: { queryLength: 10 },
				resultSummaryJson: {
					untrusted: true,
					displayText: "bounded snippet",
				},
				auditMetadata: { durationMs: 12 },
				errorCode: null,
				startedAt: new Date("2026-06-11T00:00:00.000Z"),
				completedAt: new Date("2026-06-11T00:00:01.000Z"),
				createdAt: new Date("2026-06-11T00:00:00.000Z"),
				updatedAt: new Date("2026-06-11T00:00:01.000Z"),
			},
		]);
		mocks.count.mockResolvedValue(1);
		mocks.groupBy
			.mockResolvedValueOnce([
				{ status: "succeeded", _count: { _all: 1 } },
			])
			.mockResolvedValueOnce([
				{ toolName: "rag.retrieve_context", _count: { _all: 1 } },
			]);

		const response = await GET(
			new Request(
				"http://localhost/api/admin/tools/executions?toolName=rag.retrieve_context"
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.total).toBe(1);
		expect(payload.executions[0]).not.toHaveProperty("content");
		expect(payload.executions[0]).not.toHaveProperty("prompt");
		expect(payload.executions[0]).not.toHaveProperty("rawInput");
		expect(payload.executions[0]).not.toHaveProperty("resultSummaryJson");
		expect(payload.executions[0].resultSummary).toEqual({
			present: true,
			untrusted: true,
			truncated: false,
			displayTextLength: 15,
			metadata: {},
		});
		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				select: expect.not.objectContaining({
					message: expect.anything(),
					conversation: expect.anything(),
					user: expect.anything(),
				}),
			})
		);
	});
});
