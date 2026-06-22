import { POST } from "@/app/api/chat/feedback/route";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	resolveWorkspaceContext: vi.fn(),
	withJsonIdempotency: vi.fn(),
	getUserIdempotencyActorKey: vi.fn(),
	messageFindFirst: vi.fn(),
	messageFeedbackCreate: vi.fn(),
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

vi.mock("@/lib/idempotency", () => ({
	getUserIdempotencyActorKey: mocks.getUserIdempotencyActorKey,
	withJsonIdempotency: mocks.withJsonIdempotency,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		message: {
			findFirst: mocks.messageFindFirst,
		},
		messageFeedback: {
			create: mocks.messageFeedbackCreate,
		},
	},
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: async () => new Headers(),
}));

describe("POST /api/chat/feedback", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.resolveWorkspaceContext.mockReset();
		mocks.withJsonIdempotency.mockReset();
		mocks.getUserIdempotencyActorKey.mockReset();
		mocks.messageFindFirst.mockReset();
		mocks.messageFeedbackCreate.mockReset();

		mocks.getSession.mockResolvedValue({
			user: { id: "user-1" },
		});
		mocks.resolveWorkspaceContext.mockResolvedValue({
			ok: true,
			workspace: { organizationId: "org-1" },
		});
		mocks.getUserIdempotencyActorKey.mockReturnValue("user:user-1");
		mocks.messageFindFirst.mockResolvedValue({ id: "message-1" });
		mocks.messageFeedbackCreate.mockResolvedValue({
			id: "feedback-1",
		});
		mocks.withJsonIdempotency.mockImplementation(
			async (_request, _options, callback) => {
				const result = await callback();
				return Response.json(result.body, { status: 200 });
			}
		);
	});

	it("stores structured reasons and corrections for owned messages", async () => {
		const response = await POST(
			new Request("http://localhost/api/chat/feedback", {
				method: "POST",
				body: JSON.stringify({
					messageId: "message-1",
					type: "bad",
					reasons: ["unsupported_by_source", "wrong_model"],
					comment: "The cited source does not say this.",
					correction: "Use the refund policy source.",
				}),
			}) as NextRequest
		);

		expect(response.status).toBe(200);
		expect(mocks.messageFindFirst).toHaveBeenCalledWith({
			where: {
				id: "message-1",
				conversation: {
					userId: "user-1",
					organizationId: "org-1",
				},
			},
			select: { id: true },
		});
		expect(mocks.messageFeedbackCreate).toHaveBeenCalledWith({
			data: {
				messageId: "message-1",
				userId: "user-1",
				type: "bad",
				reasons: ["unsupported_by_source", "wrong_model"],
				comment:
					"Correction:\nUse the refund policy source.\n\nComment:\nThe cited source does not say this.",
				correctionJson: {
					correctedAnswer: "Use the refund policy source.",
					correctSourceChunkId: "",
					missingSource: "",
					expectedBehavior: "",
				},
				lifecycleState: "redaction_needed",
				redactedComment: "The cited source does not say this.",
				redactedCorrectionJson: {
					correctedAnswer: "Use the refund policy source.",
					correctSourceChunkId: "",
					missingSource: "",
					expectedBehavior: "",
				},
				provenanceJson: expect.objectContaining({
					source: "chat_feedback",
					messageId: "message-1",
					reasons: ["unsupported_by_source", "wrong_model"],
				}),
			},
		});
	});

	it("rejects unknown reason IDs before writing feedback", async () => {
		const response = await POST(
			new Request("http://localhost/api/chat/feedback", {
				method: "POST",
				body: JSON.stringify({
					messageId: "message-1",
					type: "bad",
					reasons: ["not_a_real_reason"],
				}),
			}) as NextRequest
		);

		expect(response.status).toBe(400);
		expect(mocks.messageFeedbackCreate).not.toHaveBeenCalled();
	});

	it("does not accept feedback for messages outside the current workspace", async () => {
		mocks.messageFindFirst.mockResolvedValue(null);

		const response = await POST(
			new Request("http://localhost/api/chat/feedback", {
				method: "POST",
				body: JSON.stringify({
					messageId: "message-2",
					type: "good",
					reasons: [],
				}),
			}) as NextRequest
		);

		expect(response.status).toBe(404);
		expect(mocks.messageFeedbackCreate).not.toHaveBeenCalled();
	});
});
