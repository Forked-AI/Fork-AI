import { GET as getFeedback } from "@/app/api/admin/feedback/route";
import { GET as getModels } from "@/app/api/admin/models/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAdminSession: vi.fn(),
	messageFeedbackFindMany: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
	requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		messageFeedback: {
			findMany: mocks.messageFeedbackFindMany,
		},
	},
}));

describe("admin AI routes", () => {
	beforeEach(() => {
		mocks.requireAdminSession.mockReset();
		mocks.messageFeedbackFindMany.mockReset();
		mocks.requireAdminSession.mockResolvedValue({
			ok: true,
			session: { user: { id: "admin-1", role: "admin" } },
		});
	});

	it("returns model and prompt registry metadata", async () => {
		const response = await getModels(
			new Request("http://localhost/api/admin/models")
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.modelRegistry.models.length).toBeGreaterThan(0);
		expect(body.promptRegistry.models.length).toBeGreaterThan(0);
	});

	it("lists redacted feedback queue rows", async () => {
		mocks.messageFeedbackFindMany.mockResolvedValue([
			{
				id: "feedback-1",
				messageId: "message-1",
				type: "bad",
				reasons: ["missing_source"],
				lifecycleState: "redacted",
				redactedComment: "Needs source",
				redactedCorrectionJson: null,
				createdAt: new Date("2026-06-22T00:00:00.000Z"),
				updatedAt: new Date("2026-06-22T00:00:01.000Z"),
			},
		]);

		const response = await getFeedback(
			new Request("http://localhost/api/admin/feedback?state=redacted")
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mocks.messageFeedbackFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { lifecycleState: "redacted" },
				take: 100,
			})
		);
		expect(body.feedback[0]).toMatchObject({
			id: "feedback-1",
			redactedComment: "Needs source",
			createdAt: "2026-06-22T00:00:00.000Z",
		});
	});
});
