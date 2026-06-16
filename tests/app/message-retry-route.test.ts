import { POST } from "@/app/api/messages/[id]/retry/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));
const rateLimitMocks = vi.hoisted(() => ({
	checkChatRateLimit: vi.fn(),
}));
const mistralMocks = vi.hoisted(() => ({
	stream: vi.fn(),
}));
const tokenBudgetMocks = vi.hoisted(() => ({
	checkTokenBudgetBeforeRequest: vi.fn(),
}));
const idempotencyMocks = vi.hoisted(() => ({
	beginIdempotency: vi.fn(),
}));
const prismaMocks = vi.hoisted(() => ({
	conversationUpdate: vi.fn(),
	messageFindFirst: vi.fn(),
	messageFindMany: vi.fn(),
	messageCreate: vi.fn(),
	messageUpdateMany: vi.fn(),
	generationCreate: vi.fn(),
	generationUpdateMany: vi.fn(),
	usageEventCreate: vi.fn(),
	usageEventFindUnique: vi.fn(),
	usageEventUpdateMany: vi.fn(),
	quotaLedgerUpsert: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: authMocks.getSession,
		},
	},
}));

vi.mock("@/lib/chat-rate-limit", () => ({
	checkChatRateLimit: rateLimitMocks.checkChatRateLimit,
}));

vi.mock("@/lib/models", () => ({
	mistralClient: {
		chat: {
			stream: mistralMocks.stream,
		},
	},
}));

vi.mock("@/lib/token-budget", () => ({
	checkTokenBudgetBeforeRequest:
		tokenBudgetMocks.checkTokenBudgetBeforeRequest,
}));

vi.mock("@/lib/idempotency", () => ({
	beginIdempotency: idempotencyMocks.beginIdempotency,
	getUserIdempotencyActorKey: vi.fn((userId: string) => `user:${userId}`),
}));

vi.mock("@/lib/server-safe-log", () => ({
	logServerError: vi.fn(),
	logServerInfo: vi.fn(),
	logServerWarning: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: (() => {
		const database: any = {
			conversation: {
				update: prismaMocks.conversationUpdate,
			},
			message: {
				findFirst: prismaMocks.messageFindFirst,
				findMany: prismaMocks.messageFindMany,
				create: prismaMocks.messageCreate,
				updateMany: prismaMocks.messageUpdateMany,
			},
			generation: {
				create: prismaMocks.generationCreate,
				updateMany: prismaMocks.generationUpdateMany,
			},
			usageEvent: {
				create: prismaMocks.usageEventCreate,
				findUnique: prismaMocks.usageEventFindUnique,
				updateMany: prismaMocks.usageEventUpdateMany,
			},
			quotaLedger: {
				upsert: prismaMocks.quotaLedgerUpsert,
			},
		};
		database.$transaction = vi.fn(async (callback: (_tx: any) => unknown) =>
			callback(database)
		);
		return database;
	})(),
}));

async function* createProviderStream() {
	yield {
		data: {
			choices: [{ delta: { content: "Retry reply" } }],
			usage: {
				promptTokens: 4,
				completionTokens: 6,
			},
		},
	};
}

function parseSseEvents(text: string): Array<Record<string, unknown>> {
	return text
		.split(/\r?\n\r?\n/)
		.map((block) =>
			block.split(/\r?\n/).find((line) => line.startsWith("data: "))
		)
		.filter((line): line is string => Boolean(line))
		.map((line) => line.slice(6))
		.map((payload) => JSON.parse(payload) as Record<string, unknown>);
}

describe("/api/messages/[id]/retry route", () => {
	beforeEach(() => {
		authMocks.getSession.mockReset();
		rateLimitMocks.checkChatRateLimit.mockReset();
		mistralMocks.stream.mockReset();
		tokenBudgetMocks.checkTokenBudgetBeforeRequest.mockReset();
		idempotencyMocks.beginIdempotency.mockReset();
		prismaMocks.conversationUpdate.mockReset();
		prismaMocks.messageFindFirst.mockReset();
		prismaMocks.messageFindMany.mockReset();
		prismaMocks.messageCreate.mockReset();
		prismaMocks.messageUpdateMany.mockReset();
		prismaMocks.generationCreate.mockReset();
		prismaMocks.generationUpdateMany.mockReset();
		prismaMocks.usageEventCreate.mockReset();
		prismaMocks.usageEventFindUnique.mockReset();
		prismaMocks.usageEventUpdateMany.mockReset();
		prismaMocks.quotaLedgerUpsert.mockReset();

		process.env.FORK_AI_SYSTEM_PROMPT = "App system prompt";

		authMocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		rateLimitMocks.checkChatRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 9,
			resetAt: new Date("2026-04-11T10:00:00.000Z"),
		});
		idempotencyMocks.beginIdempotency.mockResolvedValue({
			started: true,
			record: {
				id: "idempotency-record-1",
				key: "test-key",
				complete: vi.fn(),
				fail: vi.fn(),
			},
		});
		mistralMocks.stream.mockResolvedValue(createProviderStream());
		tokenBudgetMocks.checkTokenBudgetBeforeRequest.mockResolvedValue({
			allowed: true,
			tier: "free",
			usageBand: "low",
			usagePercent: 1,
			trialEndsAt: null,
		});
		prismaMocks.messageFindFirst
			.mockResolvedValueOnce({ model: "mistral-large-latest" })
			.mockResolvedValueOnce({
				id: "assistant-old",
				model: "mistral-large-latest",
				parentMessageId: "user-1",
				conversationId: "conversation-1",
			})
			.mockResolvedValueOnce({
				id: "user-1",
				content: "Original prompt",
				parentMessageId: null,
			});
		prismaMocks.messageCreate.mockResolvedValue({ id: "assistant-new" });
		prismaMocks.generationCreate.mockResolvedValue({ id: "generation-1" });
		prismaMocks.messageUpdateMany.mockResolvedValue({ count: 1 });
		prismaMocks.generationUpdateMany.mockResolvedValue({ count: 1 });
		prismaMocks.usageEventCreate.mockResolvedValue({ id: "usage-1" });
		prismaMocks.usageEventFindUnique.mockResolvedValue({
			id: "usage-1",
			userId: "user-1",
			outcome: "pending",
		});
		prismaMocks.usageEventUpdateMany.mockResolvedValue({ count: 1 });
		prismaMocks.quotaLedgerUpsert.mockResolvedValue({ id: "quota-1" });
		prismaMocks.conversationUpdate.mockResolvedValue({
			id: "conversation-1",
		});
	});

	it("reuses the original user message and creates only a new assistant attempt", async () => {
		const response = await POST(
			new Request("http://localhost/api/messages/assistant-old/retry", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}) as any,
			{ params: Promise.resolve({ id: "assistant-old" }) }
		);

		const events = parseSseEvents(await response.text());

		expect(events).toContainEqual({
			type: "messageId",
			userMessageId: "user-1",
			assistantMessageId: "assistant-new",
			generationId: "generation-1",
		});
		expect(prismaMocks.messageFindMany).not.toHaveBeenCalled();
		expect(prismaMocks.messageCreate).toHaveBeenCalledTimes(1);
		expect(prismaMocks.messageCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				role: "assistant",
				content: "",
				conversationId: "conversation-1",
				parentMessageId: "user-1",
				status: "streaming",
				promptVersion: "chat-context-v1",
				contextSummaryId: null,
				contextEstimatedTokens: expect.any(Number),
				contextRecentMessageCount: 1,
				contextTotalMessageCount: 1,
			}),
			select: { id: true },
		});
		expect(mistralMocks.stream).toHaveBeenCalledWith(
			{
				model: "mistral-large-latest",
				messages: [
					expect.objectContaining({
						role: "system",
						content: expect.stringContaining("App system prompt"),
					}),
					{ role: "user", content: "Original prompt" },
				],
			},
			expect.objectContaining({
				signal: expect.any(AbortSignal),
			})
		);
	});
});
