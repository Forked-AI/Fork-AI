import { POST as cancelPOST } from "@/app/api/tools/executions/[id]/cancel/route";
import { POST as confirmPOST } from "@/app/api/tools/executions/[id]/confirm/route";
import { POST as executePOST } from "@/app/api/tools/execute/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	withJsonIdempotency: vi.fn(),
	proposeToolExecution: vi.fn(),
	confirmToolExecution: vi.fn(),
	cancelToolExecution: vi.fn(),
	checkToolExecuteRateLimit: vi.fn(),
	checkToolDecisionRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/idempotency", () => ({
	getUserIdempotencyActorKey: (userId: string) => `user:${userId}`,
	withJsonIdempotency: mocks.withJsonIdempotency,
}));

vi.mock("@/lib/tools/router", () => ({
	proposeToolExecution: mocks.proposeToolExecution,
	confirmToolExecution: mocks.confirmToolExecution,
	cancelToolExecution: mocks.cancelToolExecution,
}));

vi.mock("@/lib/tools/http", () => ({
	checkToolExecuteRateLimit: mocks.checkToolExecuteRateLimit,
	checkToolDecisionRateLimit: mocks.checkToolDecisionRateLimit,
}));

vi.mock("@/lib/server-safe-log", () => ({ logServerError: vi.fn() }));

describe("tool execution API routes", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.withJsonIdempotency.mockReset();
		mocks.proposeToolExecution.mockReset();
		mocks.confirmToolExecution.mockReset();
		mocks.cancelToolExecution.mockReset();
		mocks.checkToolExecuteRateLimit.mockReset();
		mocks.checkToolDecisionRateLimit.mockReset();
		mocks.checkToolExecuteRateLimit.mockResolvedValue({ allowed: true });
		mocks.checkToolDecisionRateLimit.mockResolvedValue({ allowed: true });
		mocks.withJsonIdempotency.mockImplementation(
			async (_request, _options, handler) => {
				const result = await handler();
				return Response.json(result.body, {
					status: result.status ?? 200,
				});
			}
		);
	});

	it("enforces tool execution rate limits before dispatch", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		mocks.checkToolExecuteRateLimit.mockResolvedValue({
			allowed: false,
			response: Response.json(
				{ errorCode: "TOOL_RATE_LIMIT_EXCEEDED" },
				{ status: 429 }
			),
		});

		const response = await executePOST(
			new Request("http://localhost/api/tools/execute", {
				method: "POST",
				body: JSON.stringify({
					toolName: "rag.retrieve_context",
					input: { query: "policy" },
				}),
			})
		);

		expect(response.status).toBe(429);
		expect(mocks.proposeToolExecution).not.toHaveBeenCalled();
	});

	it("rejects client-controlled organization context", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });

		const response = await executePOST(
			new Request("http://localhost/api/tools/execute", {
				method: "POST",
				body: JSON.stringify({
					toolName: "rag.retrieve_context",
					input: { query: "policy" },
					organizationId: "org-spoofed",
				}),
			})
		);

		expect(response.status).toBe(400);
		expect(mocks.proposeToolExecution).not.toHaveBeenCalled();
	});

	it("requires authentication for execute, confirm, and cancel", async () => {
		mocks.getSession.mockResolvedValue(null);

		await expect(
			executePOST(
				new Request("http://localhost/api/tools/execute", {
					method: "POST",
					body: JSON.stringify({ toolName: "rag.retrieve_context" }),
				})
			)
		).resolves.toMatchObject({ status: 401 });

		await expect(
			confirmPOST(
				new Request(
					"http://localhost/api/tools/executions/exec-1/confirm",
					{
						method: "POST",
						body: JSON.stringify({ input: {} }),
					}
				),
				{ params: Promise.resolve({ id: "exec-1" }) }
			)
		).resolves.toMatchObject({ status: 401 });

		await expect(
			cancelPOST(
				new Request(
					"http://localhost/api/tools/executions/exec-1/cancel",
					{
						method: "POST",
					}
				),
				{ params: Promise.resolve({ id: "exec-1" }) }
			)
		).resolves.toMatchObject({ status: 401 });
	});

	it("executes authenticated tool requests through idempotency", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		mocks.proposeToolExecution.mockResolvedValue({
			ok: true,
			execution: {
				id: "tool-exec-1",
				status: "succeeded",
				toolName: "rag.retrieve_context",
			},
		});

		const response = await executePOST(
			new Request("http://localhost/api/tools/execute", {
				method: "POST",
				headers: { "Idempotency-Key": "tool-1" },
				body: JSON.stringify({
					toolName: "rag.retrieve_context",
					input: { query: "policy" },
					conversationId: "conversation-1",
				}),
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.execution.id).toBe("tool-exec-1");
		expect(mocks.withJsonIdempotency).toHaveBeenCalledWith(
			expect.any(Request),
			expect.objectContaining({
				scope: "tools:execute",
				actorKey: "user:user-1",
			}),
			expect.any(Function)
		);
		expect(mocks.proposeToolExecution).toHaveBeenCalledWith({
			toolName: "rag.retrieve_context",
			input: { query: "policy" },
			context: {
				userId: "user-1",
				organizationId: null,
				conversationId: "conversation-1",
				messageId: null,
			},
		});
	});

	it("returns pending confirmation status for confirmation-gated tools", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		mocks.proposeToolExecution.mockResolvedValue({
			ok: true,
			execution: {
				id: "tool-exec-1",
				status: "pending_confirmation",
				toolName: "conversation.rename",
			},
		});

		const response = await executePOST(
			new Request("http://localhost/api/tools/execute", {
				method: "POST",
				body: JSON.stringify({
					toolName: "conversation.rename",
					input: { conversationId: "conversation-1", title: "New" },
				}),
			})
		);

		expect(response.status).toBe(202);
	});

	it("confirms and cancels only the authenticated user's execution", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		mocks.confirmToolExecution.mockResolvedValue({
			ok: true,
			execution: { id: "tool-exec-1", status: "succeeded" },
		});
		mocks.cancelToolExecution.mockResolvedValue({
			ok: true,
			execution: { id: "tool-exec-2", status: "cancelled" },
		});

		await confirmPOST(
			new Request(
				"http://localhost/api/tools/executions/tool-exec-1/confirm",
				{
					method: "POST",
					body: JSON.stringify({
						input: { conversationId: "c", title: "T" },
					}),
				}
			),
			{ params: Promise.resolve({ id: "tool-exec-1" }) }
		);
		await cancelPOST(
			new Request(
				"http://localhost/api/tools/executions/tool-exec-2/cancel",
				{
					method: "POST",
				}
			),
			{ params: Promise.resolve({ id: "tool-exec-2" }) }
		);

		expect(mocks.confirmToolExecution).toHaveBeenCalledWith({
			executionId: "tool-exec-1",
			input: { conversationId: "c", title: "T" },
			context: { userId: "user-1", organizationId: null },
		});
		expect(mocks.cancelToolExecution).toHaveBeenCalledWith({
			executionId: "tool-exec-2",
			context: { userId: "user-1" },
		});
	});
});
